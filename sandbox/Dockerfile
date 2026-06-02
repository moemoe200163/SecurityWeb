FROM kalilinux/kali-rolling:latest

# Install common security tools and egress-policy tooling
RUN apt-get update && apt-get install -y --no-install-recommends \
    nmap \
    sqlmap \
    nikto \
    hydra \
    python3 \
    python3-pip \
    iptables \
    jq \
    ca-certificates \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Install holehe
RUN pip3 install --no-cache-dir --break-system-packages holehe

# Install egress policy
COPY egress-policy.sh /usr/local/bin/egress-policy.sh
COPY egress.conf.example /etc/sandbox/egress.conf.example
RUN chmod +x /usr/local/bin/egress-policy.sh \
    && mkdir -p /etc/sandbox

# Apply egress policy before CMD runs
ENTRYPOINT ["/usr/local/bin/egress-policy.sh"]
CMD ["tail", "-f", "/dev/null"]
