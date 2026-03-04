# WhatsApp Customer Support AI

LLM-powered WhatsApp bot that acts as a customer support representative.  
It handles customer service requests and complaints, and forwards structured email summaries to streamline support workflows.

---

# Requirements

- Node.js (v18+ recommended)
- npm
- CMake
- C++ toolchain (required to build `llama.cpp`)
  - Windows: Visual Studio Build Tools
  - Linux/macOS: GCC or Clang

---

# Installation

1) Install Node dependencies

```bash
npm install
```

2) Build `llama.cpp`

```bash
cd llama.cpp
mkdir build
cd build
cmake ..
cmake --build .
cd ../..
```

3) Start the configuration server

```bash
node configserver.js
```

4) Open the GUI

```
http://localhost:3000
```

---

# Notes

- `llama.cpp` must be compiled before first use.
- Users must configure their own WhatsApp credentials locally.
- If using Gmail, create an App Password for the email adress the bot will be using.
