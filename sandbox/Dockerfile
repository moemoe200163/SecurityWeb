FROM kalilinux/kali-rolling:latest

# Install common security tools
RUN apt-get update && apt-get install -y --no-install-recommends \
    nmap \
    sqlmap \
    nikto \
    hydra \
    python3 \
    python3-pip \
    iptables \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Install holehe
RUN pip3 install --no-cache-dir --break-system-packages holehe

# Keep container running
CMD ["tail", "-f", "/dev/null"]
