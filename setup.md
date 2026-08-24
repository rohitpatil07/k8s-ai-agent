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
