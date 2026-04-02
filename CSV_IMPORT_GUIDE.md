# QuizBuilder Pro: CSV Import Guide

This guide explains how to format your CSV files for importing questions into QuizBuilder Pro. The importer is designed to be flexible, supporting dynamic answer counts, automatic type inference, and automatic quiz naming.

---

## 1. Quick Start Template

To create a valid CSV, ensure your first row contains the following headers (case-sensitive):

| Header Name | Required? | Description |
| :--- | :--- | :--- |
| **Order Number** | Optional | The sequence of the question (e.g., `1`, `2`, `3`). |
| **Question Type** | Optional | The type of question (see "Automatic Type Inference" below). |
| **Question Text** | **Yes** | The main question or heading text. |
| **Information Content** | Optional | Extra text used only for "Information Blocks". |
| **Answer Explanation** | Optional | Text shown to the user after they answer. |
| **Answer 1** | Optional | Text for the first option. |
| **Answer 2** | Optional | Text for the second option. |
| **Answer X** | Optional | You can add as many columns as you need (`Answer 3`, `Answer 4`, etc.). |
| **Correct Answer** | **Yes*** | 1-based index of the correct choice(s). *Not required for Info Blocks. |

---

## 2. Automatic Type Inference

If you leave the **Question Type** column blank, the system will intelligently guess the type based on your data:

*   **True / False**: Automatically detected if `Answer 1` is "True" and `Answer 2` is "False" (case-insensitive).
*   **Multiple Answer**: Automatically detected if the `Correct Answer` column contains multiple values separated by commas or semicolons (e.g., `1,3`).
*   **Information Block**: Automatically detected if there are no answers provided but the `Information Content` field is filled.
*   **Single Answer**: The default fallback for standard questions with exactly one correct answer.

> **Manual Override:** You can manually specify types using these strings: `Single Answer Multiple Choice`, `Multiple Answer Multiple Choice`, `True / False`, or `Information Block`.

---

## 3. Correct Answer Formatting

The **Correct Answer** column uses **1-based indices** (1 for Answer 1, 2 for Answer 2, etc.).

*   **Single Choice:** Enter a single number (e.g., `2`).
*   **Multiple Choice:** Enter numbers separated by commas or semicolons (e.g., `1,3` or `1;2;4`).
*   **True / False:** Use `1` for True and `2` for False.

---

## 4. Advanced Features

### Dynamic Answer Choices
You are not limited to 4 choices. If you need 10 options, simply add columns up to `Answer 10`. The importer will automatically detect and import all columns starting with "Answer " followed by a number.

### Automatic Quiz Naming
When you import a CSV file, the system will automatically set the **Quiz Title** to the name of your file (without the extension). 
*Note: This only happens if your quiz is currently named "New Quiz". If you have already renamed your quiz, the importer will not overwrite it.*

---

## 5. Example CSV Layout

| Order Number | Question Text | Answer 1 | Answer 2 | Answer 3 | Correct Answer | Inferred Type |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| 1 | What is the capital of France? | London | Paris | Berlin | 2 | **Single Answer** |
| 2 | Select the prime numbers. | 2 | 3 | 4 | 1,2 | **Multiple Answer** |
| 3 | The Earth is flat. | True | False | | 2 | **True / False** |
| 4 | Important Instructions | | | | | **Info Block** |

---

## 6. Tips for Success
*   **Encoding:** Always save your CSV using **UTF-8** encoding.
*   **Excel Users:** If you use Excel, ensure your "Correct Answer" column isn't being automatically formatted as a date (e.g., `1,2` becoming `Jan-02`). Setting the column format to "Text" prevents this.
*   **Export as Template:** The best way to get a perfect template is to create one question of each type in the editor and click **Export CSV**.
