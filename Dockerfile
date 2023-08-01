FROM      --platform=linux/amd64 node:18

# Install Modules:
COPY      . /usr/src/app
WORKDIR   /usr/src/app

# Set Environment Variables:
ENV       NODE_OPTIONS=--openssl-legacy-provider

# Install dependencies:
RUN       npm install
RUN       npx hardhat compile
CMD       ["npm", "run", "run"]