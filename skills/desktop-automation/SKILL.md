---
name: desktop-automation
display_name: Desktop Automation (桌面自动化)
description: Interact with macOS desktop applications (Calendar, Mail, Messages/WeChat) using AppleScript.
default_in_chat: false
version: 1.0.0
parameters:
  type: object
  properties:
    action:
      type: string
      description: The action to perform. One of 'add_calendar_event', 'list_calendar_events', 'send_email', 'read_emails', 'send_message', 'read_recent_messages'.
    # Calendar Params
    title:
      type: string
      description: (Calendar Add) Event title.
    start_time:
      type: string
      description: (Calendar Add/List) Start time (YYYY-MM-DD HH:mm). For list, defaults to now.
    end_time:
      type: string
      description: (Calendar Add/List) End time (YYYY-MM-DD HH:mm). For list, defaults to end of day.
    notes:
      type: string
      description: (Calendar Add) Description or notes.
    # Email Params
    to_email:
      type: string
      description: (Email Send) Recipient email address.
    subject:
      type: string
      description: (Email Send) Email subject.
    body:
      type: string
      description: (Email Send) Email body content.
    attachment_path:
      type: string
      description: (Email Send) Absolute path to attachment file (optional).
    count:
      type: number
      description: (Email/Message Read) Number of items to read. Default 5.
    # Message Params
    app_target:
      type: string
      description: "(Message) Target app: 'WeChat' or 'Messages'."
    contact_name:
      type: string
      description: (Message Send/Read) Name of the contact.
    message_content:
      type: string
      description: (Message Send) Content of the message.
  required:
    - action
---

# Desktop Automation
Control native macOS applications to perform daily tasks.

## Actions

### add_calendar_event / list_calendar_events
Manage calendar events. `list_calendar_events` returns events between `start_time` and `end_time`.

### send_email / read_emails
Manage emails. `read_emails` fetches recent unread emails from the "Inbox".

### send_message / read_recent_messages
Manage messages.
- `read_recent_messages`:
  - **Messages**: Reads chat history with `contact_name` or recent messages.
  - **WeChat**: **Experimental**. Tries to read the visible chat text of the currently active chat or searches for `contact_name` and reads visible text. Requires WeChat to be open.
