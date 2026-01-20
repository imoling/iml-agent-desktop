---
name: excel-to-csv
display_name: Excel to CSV Converter (Excel转CSV)
description: Convert Excel files (.xlsx, .xls) to CSV format for easier processing.
default_in_chat: false
version: 1.0.0
parameters:
  type: object
  properties:
    input_path:
      type: string
      description: Absolute path to the source Excel file.
    output_path:
      type: string
      description: Optional absolute path for the output CSV file. Defaults to same directory with .csv extension.
    sheet_name:
      type: string
      description: Optional name of the sheet to convert. Defaults to the first sheet.
  required:
    - input_path
    - output_path
    - sheet_name
---

# Excel to CSV Converter (Excel转CSV)
Convert Excel files (.xlsx, .xls) to CSV format for easier processing.