FROM kalilinux/kali-rolling:latest

ENV DEBIAN_FRONTEND=noninteractive

# Install security tools used by tool templates
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
      nmap \
      nikto \
      hydra \
      sqlmap \
      python3-pip \
      curl \
      ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# holehe is not in Kali repos — install via pip
RUN pip3 install --break-system-packages holehe
