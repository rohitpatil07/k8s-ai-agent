# Curl to download binary
curl -fsSL https://ollama.com/install.sh | sh

# Serve
ollama serve

#  Check version
ollama -v

# Pull a model
# ollama pull qwen3:8b

# For smaller model
ollama pull qwen3:1.7b

# Check 
curl http://127.0.0.1:11434/api/tags

# List models
ollama list