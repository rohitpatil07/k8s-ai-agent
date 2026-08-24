# Set up API key
Go to the OpenAI API platform and sign in: [OpenAI API Platform](https://platform.openai.com/?utm_source=chatgpt.com). You can create an API key from the API key section.

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

# Set up project
```
mkdir k8s-ai-agent
cd k8s-ai-agent
npm init -y 
npm install -D typescript tsx @types/node   
npx tsc --init 
```

Sample package.json
```
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
  }
}
```

tsconfig.json
```
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
```

Set up source file
```
mkdir src
touch src/index.ts
```

Install k8s client
```
npm install @kubernetes/client-node
npm approve-scripts --allow-scripts-pending
```


Set up client

```
mkdir src/kubernetes
touch src/kubernetes/client.ts
```

client.ts
```
import * as k8s from "@kubernetes/client-node";

const kc = new k8s.KubeConfig();

kc.loadFromDefault();

export const coreApi = kc.makeApiClient(k8s.CoreV1Api);
```


minimal call 
src/index.ts
```
import { coreApi } from "./kubernetes/client.js";

const response = await coreApi.listNamespace();

console.log(
  response.items.map((namespace) => namespace.metadata?.name)
);
```

src/kubernetes/pods.ts
```
import { coreApi } from "./client.js";

export async function getPods(namespace: string) {
  const response = await coreApi.listNamespacedPod({
    namespace,
  });

  return response.items.map((pod) => ({
    name: pod.metadata?.name,
    namespace: pod.metadata?.namespace,
    phase: pod.status?.phase,
  }));
}
```

#Run a sample failure pod
```
kubectl run failurepod \
  --image=someimage \
  --restart=Never
```

# Run OOM test pod
```
kubectl run oompod \
  --image=busybox \
  --restart=Never \
  --overrides='
{
  "spec": {
    "containers": [{
      "name": "oompod",
      "image": "busybox",
      "command": ["sh", "-c", "dd if=/dev/zero of=/dev/shm/test bs=1M count=50"],
      "resources": {
        "limits": {
          "memory": "10Mi"
        }
      }
    }]
  }
}'
```

# Run pending pod test
```
kubectl run pendingpod \
  --image=busybox \
  --restart=Never \
  --overrides='
{
  "spec": {
    "containers": [{
      "name": "pendingpod",
      "image": "busybox",
      "resources": {
        "requests": {
          "cpu": "1000"
        }
      }
    }]
  }
}'
```

# Pending PVC
## create pvc
```
kubectl apply -f - <<'EOF'
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: failing-pvc
spec:
  storageClassName: does-not-exist
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 1Gi
EOF
```

## create pod with that pvc
```
kubectl apply -f - <<'EOF'
apiVersion: v1
kind: Pod
metadata:
  name: pvcpod
spec:
  containers:
    - name: pvcpod
      image: busybox
      command: ["sleep", "3600"]
      volumeMounts:
        - name: data
          mountPath: /data
  volumes:
    - name: data
      persistentVolumeClaim:
        claimName: failing-pvc
EOF
```
