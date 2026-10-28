#!/bin/bash

echo "Installing Node.js and npm..."
sudo apt install npm -y
npm cache clean -f
npm install -g n
n 24

# install k3s
curl -sfL https://get.k3s.io | sh -
export KUBECONFIG=/etc/rancher/k3s/k3s.yaml 

# export alias
alias k=kubectl
alias syncrepo="git pull && npm run dev"
alias syncbuild="git pull && npm run build"
alias synctest="git pull && npm run test"

# ai
export OPENROUTER_MODEL="nvidia/nemotron-3.5-lightning:free"
export OPENROUTER_API_KEY=

# clone repo 
git clone https://github.com/rohitpatil07/k8s-ai-agent.git

# Spin up sample pod
k run nginx --image nginx

#Build and test initial setup
cd k8s-ai-agent/agent
npm i -y && npm run build && npm start



