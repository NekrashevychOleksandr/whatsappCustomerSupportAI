# WhatsApp LLM Customer Support Workflow Agent

An LLM-powered WhatsApp-based customer support system that processes incoming messages, classifies intent, manages clarification flows, and routes structured support tickets to human agents via email escalation.

The system is designed as a workflow orchestration engine rather than a traditional chatbot, focusing on structured decision-making, conversation state tracking, and automated support routing.

---

## Features

- WhatsApp integration via whatsapp-web.js
- LLM-powered intent classification using Groq API
- Stateful ticket system per user (in-memory session tracking)
- Multi-turn clarification loop for vague or incomplete requests
- Confidence-based decision making (clarify vs confirm vs escalate)
- Automatic human escalation detection (e.g. “human”, “agent”, “representative”)
- Structured ticket summarization for internal teams
- Email-based escalation pipeline (support / sales / complaints / human)
- Confirmation flow before final submission (“Is this correct?”)
- Workflow-style routing engine (not a freeform chatbot)
- Customer identity tracking (WhatsApp User ID + phone number extraction)

---

## System Overview

The system processes each message through a structured decision pipeline:

User Message → WhatsApp Listener → Memory Store →  
LLM Intent Classification → Ticket State Update →  
Workflow Decision Engine →  
(Clarify / Confirm / Escalate) →  
Optional Email Escalation → Human Support Team  

---

## Tech Stack

- Node.js
- whatsapp-web.js
- Groq SDK (LLM inference)
- Nodemailer (email escalation)
- qrcode-terminal (WhatsApp login)
- dotenv (environment management)

---

## Architecture

The system is built around a stateful workflow ticket model:

Each user session maintains a ticket object:

- intent → classified user request type
- clarity → confidence score from LLM
- missing_fields → required missing information
- collected_fields → extracted structured data
- status → collecting → ready → confirmed → escalated
- userId → WhatsApp identifier (`msg.from`)
- phoneNumber → extracted MSISDN for human contactability

This ensures deterministic routing while still leveraging LLM reasoning for understanding user intent.

---

## Email Escalation Payload

When a ticket is confirmed and sent to support, the email includes:

- WhatsApp User ID (e.g. `123456789@c.us`)
- Phone Number (e.g. `123456789`)
- Intent classification
- Generated summary
- Full conversation history

This ensures support agents can:
- Identify the customer reliably
- Contact them outside WhatsApp if needed
- Trace messages back to the exact WhatsApp session

---

## Installation

```bash
git clone https://github.com/NekrashevychOleksandr/whatsappCustomerSupportAI.git
cd whatsappCustomerSupportAI
npm install
```

---
## Environment Setup

Create a `.env` file in the root directory:

```bash
GROQ_API_KEY=your_groq_api_key
EMAIL_USER=your_email_address
EMAIL_PASS=your_email_password
```

---


## Running the Bot

```bash
node bot.js
```

On first run:

- A QR code will appear in the terminal
- Scan it using WhatsApp to authenticate
- Session will persist locally using LocalAuth

---


## Escalation Handling

If a user requests a human agent:

The system immediately detects keywords like:

- "human"
- "agent"
- "representative"

The request is escalated and:

- Conversation is marked as escalated
- A structured summary is generated
- Email is sent to support team including:
    - WhatsApp User ID
    - Phone number (for direct contact)
    - Full conversation context

---


## Key Design Goals

- Structured workflow over freeform chatbot behavior
- Deterministic routing with LLM-assisted understanding
- Human-in-the-loop escalation system
- Lightweight, extensible backend architecture
- Real-world messaging integration (WhatsApp)
- Reliable customer identity extraction for support workflows

---

## Limitations

- No persistent database
- No retry queue for failed email sends
- No dashboard or admin interface yet
- Basic intent classification (LLM-dependent)
- Requires Chromium for WhatsApp Web automation
- In-memory ticket state (resets on restart)

---

## Future Improvements

- Redis or database-backed session storage
- Admin dashboard for ticket management
- Retry-safe LLM + email pipeline
- Structured JSON schema validation for tickets
- Analytics on intent distribution and resolution rates
- Persistent customer profiles linked to phone numbers

---

## License

MIT License

---