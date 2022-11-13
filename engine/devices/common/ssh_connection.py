import sys
import time
from io import BytesIO
from typing import Dict, Optional

import paramiko

MAX_COMMANDS_PER_LINE = 10_000


class SshConnection:
    def __init__(self, ssh_config: Dict):
        self.ssh_config = ssh_config

        self.fifo_dev_files = []
        if 'fifo_dev_files' in ssh_config:
            self.fifo_dev_files = ssh_config['fifo_dev_files']

        self.device_command_format = ssh_config['device_command_format']
        self.get_device_state_command = ssh_config['get_device_state_command']
        self.remote_file_location = ssh_config['remote_file_location']
        self.remove_remote_files = ssh_config['remove_remote_files']

        self.write_evenly_tool = ""
        if 'write_evenly_tool' in ssh_config:
            self.write_evenly_tool = ssh_config['write_evenly_tool']

        self.ssh = None

        self.connect()

    def ensure_connection(self):
        """Check if the device is connected. If it's not, try to connect. Return connection status."""
        if self.is_connected():
            return True

        self.connect()
        return self.ssh is not None

    def connect(self):
        try:
            self.ssh = paramiko.SSHClient()
            self.ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
            self.ssh.connect(self.ssh_config['host'],
                             port=self.ssh_config['port'],
                             username=self.ssh_config['username'],
                             password=self.ssh_config['password'])

        except:
            self.ssh = None
            print(f'Could not connect to {self.ssh_config["host"]}:{self.ssh_config["port"]}')

    def is_connected(self):
        if self.ssh is None:
            return False

        try:
            transport = self.ssh.get_transport()
            if transport is None or not transport.is_active():
                self.ssh = None
                return False

            self.ssh.exec_command('ls', timeout=0.1)
        except EOFError as e:
            self.ssh = None
            return False

        return True

    def exec_chip_commands(self, commands: Dict[int, BytesIO]):
        """Execute Intan chip commands. The keys of the input should be
        the chip IDs, and the values should be the lists of commands to be
        executed."""
        if self.ssh is None:
            print(f'Could not send commands; SSH client is not connected.')
            return None

        # Upload the groups of commands as files over SFTP
        sftp = self.ssh.open_sftp()
        remote_files = {}

        start_upload = time.time()
        for chip, chip_commands in commands.items():
            chip_commands.seek(0)
            if len(chip_commands.getbuffer()) == 0:
                continue

            remote_file = self.make_commands_file(chip)
            sftp.putfo(chip_commands, remote_file)
            remote_files[chip] = remote_file

        # Send the commands into the command FIFO devices for each chip
        command_str = '' + self.write_evenly_tool

        for remote_file in remote_files.values():
            command_str += f' {remote_file} '

        for chip in remote_files.keys():
            fifo_dev = self.fifo_dev_files[chip]
            command_str += f' {fifo_dev}'

        if self.remove_remote_files:
            for remote_file in remote_files.values():
                command_str += f'; rm {remote_file}'

        start_insert = time.time()
        self.exec_ssh(command_str)
        now = time.time()
        print(f'Upload: {start_insert - start_upload}; insert: {now - start_insert}')
        sys.stdout.flush()

    def exec_same_chip_commands_on_all(self, commands: BytesIO):
        """Execute Intan chip commands on all chips"""
        commands_dict = {}
        for i in range(len(self.fifo_dev_files)):
            commands_dict[i] = commands

        self.exec_chip_commands(commands_dict)

    def exec_device_command(self, command: str):
        """Execute general device commands like 'start' or 'stop'."""
        command_str = self.device_command_format.format(command)
        self.exec_ssh(command_str)

    def exec_get_device_state(self):
        return self.exec_ssh(self.get_device_state_command)

    def exec_ssh(self, commands: str) -> Optional[str]:
        """Run a linux command over the SSH connection"""
        if self.ssh is None:
            print(f'Could not send commands; SSH client is not connected.')
            return None

        if (commands is None) or (len(commands) == 0):
            return None

        stdin, stdout, stderr = self.ssh.exec_command(commands)
        result = stdout.read() + stderr.read()
        return result.decode('utf-8')

    def make_commands_file(self, chip_num):
        timestamp = round(time.time() * 1000)
        return f'{self.remote_file_location}/cmd_{chip_num}_{timestamp}.bin'
