#!/bin/bash

echo "Installing Node.js and npm..."
sudo apt install npm -y
npm cache clean -f
npm install -g n
n 24


#Set up the project directory
mkdir k8s-ai-agent
cd k8s-ai-agent

#Uses existing packages to Create a pckage.json file
echo "Creating package.json file..."

cat << EOF > package.json
{
  "name": "k8s-ai-agent",
  "version": "1.0.0",
  "description": "",
  "main": "index.js",
  "scripts": {
    "dev": "tsx src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js"
  },
  "keywords": [],
  "author": "",
  "license": "ISC",
  "type": "module",
  "devDependencies": {
    "@types/node": "^26.2.0",
    "tsx": "^4.23.12",
    "typescript": "^7.0.2"
  },
  "dependencies": {
    "@kubernetes/client-node": "^2.0.0"
  }
}
EOF

echo "Creating tsconfig.json file..."
cat << EOF > tsconfig.json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "rootDir": "./src",
    "outDir": "./dist",

    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,

    "forceConsistentCasingInFileNames": true
  },
  "include": ["src"]
}
EOF

#Set up the source directory structure
mkdir -p src
mkdir -p src/kubernetes

touch src/index.ts

echo "console.log('Hello, Kubernetes AI Agent!');" > src/index.ts


#Build and test initial setup
npm i -y && npm run build && npm start

