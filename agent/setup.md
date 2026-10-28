# Install Node
```
sudo apt update
sudo apt install npm
```

# Upgrade to 24
```
npm cache clean -f
npm install -g n
n 24
```

# install k3s
```
curl -sfL https://get.k3s.io | sh -
export KUBECONFIG=/etc/rancher/k3s/k3s.yaml 
```

# Export values for AI Model
export OPENROUTER_MODEL="nvidia/nemotron-3.5-lightning:free"
export OPENROUTER_API_KEY=

# Initiate a nginx pod
kubectl run nginx --image nginx

# Build and test initial setup
cd k8s-ai-agent
npm i -y && npm run build && npm start

# Start the server with k3s config
KUBECONFIG=/etc/rancher/k3s/k3s.yaml npm run dev:api