FROM node:18-slim

WORKDIR /circuits

RUN apt-get update && apt-get install -y \
    curl \
    build-essential \
    git \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
COPY production/ ./production/
COPY pot12_final.ptau ./

RUN npm install

COPY compile-production.sh ./

RUN chmod +x compile-production.sh

ENTRYPOINT ["/bin/bash", "compile-production.sh"]
