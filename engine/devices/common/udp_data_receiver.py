import logging
import math
import os
import select
import socket
import threading
import time
from multiprocessing import Process, Queue
from typing import List, Dict, Iterable

import numpy as np
import psutil

from util import electrode_name

MAX_SAMPLES = 100_000
MAX_MESSAGES = 10_000
BUFFER_SIZE = 50_000


def exit_if_parent_exits(parent_pid):
    while True:
        time.sleep(1)
        if parent_pid not in psutil.pids():
            return


def receive_udp_messages(ports, msg_queue, parent_pid):
    socks = []

    # Start a thread that will monitor whether the parent is still around.
    parent_monitor_thread = threading.Thread(target=exit_if_parent_exits, args=(parent_pid,))
    parent_monitor_thread.start()

    # Start listening on the sockets. We'll use asynchronous sockets. If we use synchronous
    # sockets, some of the UDP packets will be dropped.
    for port in ports:
        print(f'Setting up port {port}')
        sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        sock.bind(('0.0.0.0', port))
        sock.setblocking(False)
        sock.setsockopt(socket.SOL_SOCKET, socket.SO_RCVBUF, 65536)
        socks.append(sock)

    batch = []
    last_queue_send_time = time.time()
    min_queue_send_delay = 0.01

    # Continuously poll the sockets for results.
    while True:
        socks_ready, _, _ = select.select(socks, [], [], 1)

        if not parent_monitor_thread.is_alive():
            msg_queue.close()
            os.abort()

        for sock in socks_ready:
            (_, port) = sock.getsockname()
            port_num = ports.index(port)
            buffer = sock.recv(8200)

            batch.append((buffer, port_num))
            now = time.time()

            # To prevent overloading the queue, we'll batch the results into lists of received messages.
            if (now - last_queue_send_time) > min_queue_send_delay:
                msg_queue.put_nowait(batch)
                batch = []
                last_queue_send_time = now

            if msg_queue.full():
                print("Queue is full")


class UdpDataReceiver:
    def __init__(self,
                 ports: List[int],
                 channels_per_port: int,
                 dwords_per_batch: int,
                 extract_dc: bool):
        self.ports = ports
        self.num_channels = channels_per_port * len(ports)
        self.channels_per_port = channels_per_port
        self.dwords_per_batch = dwords_per_batch
        self.logger = logging.getLogger(__name__)
        self.logger.setLevel(logging.INFO)
        self.extract_dc = extract_dc

        self.msg_queue = Queue(maxsize=10_000)

        # Receive UDP messages in a separate process. As far as I can tell, this is the only way to make sure
        # that we receive every UDP message.
        self.process = Process(target=receive_udp_messages, args=(ports, self.msg_queue, os.getpid()))
        self.process.start()

    def close(self):
        self.process.terminate()
        self.process.join()
        self.process.close()

    def process_message(self, buffer, port_num, channel_groups, num_samples_per_channel):
        # Each message consists of one or more 20 4-byte blocks.
        # Each of these 20 blocks contains:
        #       * 16 channel samples (in order from 0 to 15)
        #       * 4 command responses

        # Each 4-byte channel sample:
        #
        #       bit id: 3 3 2 2 2 2 2 2 2 2 2 2 1 1 1 1 1 1 1 1 1 1 0 0 0 0 0 0 0 0 0 0
        #               1 0 9 8 7 6 5 4 3 2 1 0 9 8 7 6 5 4 3 2 1 0 9 8 7 6 5 4 3 2 1 1
        #              |            AC sample          |      DC sample    | Channel ID|

        # There's a chance that the channel samples are not exactly aligned to the
        # start of the UDP packet, so we'll have to figure out which channel we should
        # be starting with.
        raw_samples = np.frombuffer(buffer, dtype='<u4')
        channel_ids = raw_samples[0:self.dwords_per_batch] & 0b111111
        first_channel_offset = np.argmax(channel_ids == 0)

        num_new_samples_per_channel = math.floor(len(raw_samples) / self.dwords_per_batch)
        raw_samples.shape = (num_new_samples_per_channel, self.dwords_per_batch)
        raw_ac_samples = raw_samples >> 16

        rescaled_ac_samples = raw_ac_samples.astype('f4')
        rescaled_ac_samples -= 32768
        rescaled_ac_samples *= (0.195 / 1000 / 1000)

        if self.extract_dc:
            raw_dc_samples = ((raw_samples >> 6) & 0b1111111111)
            rescaled_dc_samples = raw_dc_samples.astype('f4')
            rescaled_dc_samples -= 512
            rescaled_dc_samples *= (-19.23) / 1000

        from_channel = port_num * self.channels_per_port

        for i in range(self.channels_per_port):
            channel_position_in_packet = (first_channel_offset + i) % self.dwords_per_batch
            from_index = num_samples_per_channel[from_channel + i]
            to_index = from_index + num_new_samples_per_channel

            if to_index > BUFFER_SIZE:
                continue

            ac_samples = channel_groups['ac']
            dc_samples = channel_groups['dc']
            ac_samples[from_channel + i][from_index:to_index] = \
                rescaled_ac_samples[:, channel_position_in_packet]

            if self.extract_dc:
                dc_samples[from_channel + i][from_index:to_index] = \
                    rescaled_dc_samples[:, channel_position_in_packet]
            num_samples_per_channel[from_channel + i] += num_new_samples_per_channel

    def collect_data(self) -> Dict[str, Iterable]:
        queue_size_approx = self.msg_queue.qsize()
        messages_taken = 0
        total_buffers = 0

        channel_groups = {
            'ac': [np.zeros(BUFFER_SIZE, float) for _ in range(self.num_channels)],
            'dc': [np.zeros(BUFFER_SIZE, float) for _ in range(self.num_channels)]
        }

        num_samples_per_channel = [0 for _ in range(self.num_channels)]

        while not self.msg_queue.empty() and messages_taken < queue_size_approx:
            messages_taken += 1
            messages = self.msg_queue.get()

            for (buffer, port_num) in messages:
                total_buffers += 1
                self.process_message(buffer, port_num, channel_groups, num_samples_per_channel)

        if max(num_samples_per_channel) == 0:
            return dict()

        results = dict()

        ac_channels = channel_groups['ac']
        dc_chammels = channel_groups['dc']

        for i in range(self.num_channels):
            results[electrode_name(i, 'ac')] = ac_channels[i][:num_samples_per_channel[i]]
            results[electrode_name(i, 'dc')] = dc_chammels[i][:num_samples_per_channel[i]]

        return results
