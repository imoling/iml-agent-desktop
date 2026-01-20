---
name: audio-transcriber
display_name: Audio Transcriber
description: "Transcribe audio files to text using the embedded offline voice recognition module."
default_in_chat: false
version: 1.0.0
parameters:
  type: object
  properties:
    filePath:
      type: string
      description: "The absolute path to the audio file to transcribe."
    language:
      type: string
      description: "The language code (default: 'chinese')."
  required:
    - filePath
---

# Audio Transcriber
Transcribe audio files to text using the embedded offline voice recognition module.