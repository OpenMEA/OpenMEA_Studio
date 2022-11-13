FROM gcc:11-bullseye

# Install and run SSH
RUN apt-get update && apt-get install -y openssh-server sudo

# Set the root passwort to 'root'
RUN echo 'root:root' | chpasswd
RUN echo "PermitRootLogin yes" >> /etc/ssh/sshd_config

# Set up write_evenly tool
COPY ./write_evenly /root/brainkern/write_evenly
WORKDIR /root/brainkern/write_evenly
RUN make clean
RUN make

RUN service ssh start
EXPOSE 22
CMD ["/usr/sbin/sshd","-D"]