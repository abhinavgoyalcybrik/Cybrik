# Reading Tests Catalog

## Overview
Successfully uploaded **48 Cambridge IELTS Reading Tests** from official Cambridge materials.

## Test Inventory

### 📚 Books Included
- **Cambridge IELTS 1** - 4 tests (Tests 1-4)
- **Cambridge IELTS 3** - 4 tests (Tests 1-4)
- **Cambridge IELTS 5** - 4 tests (Tests 1-4)
- **Cambridge IELTS 8** - 4 tests (Tests 1-4)
- **Cambridge IELTS 10** - 4 tests (Tests 1-4)
- **Cambridge IELTS 11** - 4 tests (Tests 1-4)
- **Cambridge IELTS 12** - 4 tests (Tests 1-4)
- **Cambridge IELTS 13** - 4 tests (Tests 1-4)
- **Cambridge IELTS 14** - 4 tests (Tests 1-4)
- **Cambridge IELTS 15** - 4 tests (Tests 1-4)
- **Cambridge IELTS 16** - 4 tests (Tests 1-4)
- **Cambridge IELTS 17** - 4 tests (Tests 1-4)

**Total: 12 books × 4 tests = 48 tests**

## File Structure

### Location
`/public/data/reading_tests.json` (2.1 MB)

### Format
```json
{
  "metadata": {
    "total_tests": 48,
    "generated_at": "2026-01-30",
    "description": "Cambridge IELTS Academic Reading Tests",
    "books_included": [...]
  },
  "tests": [
    {
      "id": "01RT01",
      "title": "Cambridge IELTS 1 Test 1",
      "description": "IELTS Academic Reading Test from Cambridge IELTS 1",
      "book": "Cambridge IELTS 1",
      "test_number": 1,
      "passages": [
        // 3 passages per test
        // Each passage has multiple question groups
      ]
    }
  ]
}
```

## Test ID Format
- **Pattern**: `{book}{RT}{test}`
- **Examples**: 
  - `01RT01` = Cambridge IELTS 1, Reading Test 1
  - `16RT03` = Cambridge IELTS 16, Reading Test 3

## Question Types Supported
- ✅ Multiple Choice Questions (MCQ)
- ✅ True/False/Not Given
- ✅ Yes/No/Not Given
- ✅ Matching Headings
- ✅ Matching Information
- ✅ Matching Features
- ✅ Sentence Completion
- ✅ Summary Completion
- ✅ Note Completion
- ✅ Table Completion
- ✅ Flow Chart Completion
- ✅ Diagram Labeling
- ✅ Short Answer Questions

## Each Test Contains
- **3 Passages** (increasing difficulty)
- **40 Questions** total
- **60 minutes** time limit
- Authentic academic texts
- Mixed question types per passage

## Access Control
- **Free Users**: Access to 1st test only (01RT01)
- **Premium Users**: Full access to all 48 tests

## Generated
- **Date**: January 30, 2026
- **Script**: `/scripts/process_reading_tests.py`
- **Source**: `/readingg/readingg/*.json`

## Usage in Frontend
Tests are loaded via:
```typescript
const response = await fetch('/data/reading_tests.json');
const data = await response.json();
const tests = data.tests;
```

## Band Score Conversion
The system automatically converts raw scores (0-40) to IELTS band scores (1-9) using official conversion tables.

## Notes
- All tests are Academic module
- General Training tests are separate
- Tests maintain original Cambridge formatting
- Answer keys are embedded in the data structure
