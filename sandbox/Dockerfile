FROM kalilinux/kali-rolling:latest

# Install common security tools
RUN apt-get update && apt-get install -y --no-install-recommends \
    nmap \
    sqlmap \
    nikto \
    hydra \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Keep container running
CMD ["tail", "-f", "/dev/null"]
