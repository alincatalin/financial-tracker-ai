/**
 * File Utilities - Shared helpers for safe file operations
 */

const fs = require('fs');

/**
 * Safely load and parse a JSON file with error handling
 * @param {string} filepath - Path to the JSON file
 * @param {*} defaultValue - Default value to return if file fails to load
 * @returns {*} Parsed JSON data or defaultValue
 */
function loadJSONFile(filepath, defaultValue = null) {
  try {
    if (!fs.existsSync(filepath)) {
      console.warn(`⚠️  File not found: ${filepath}`);
      return defaultValue;
    }

    const content = fs.readFileSync(filepath, 'utf8');

    if (!content || content.trim() === '') {
      console.warn(`⚠️  File is empty: ${filepath}`);
      return defaultValue;
    }

    return JSON.parse(content);
  } catch (error) {
    if (error instanceof SyntaxError) {
      console.error(`❌ Invalid JSON in ${filepath}: ${error.message}`);
    } else {
      console.error(`❌ Failed to load ${filepath}: ${error.message}`);
    }
    return defaultValue;
  }
}

/**
 * Safely write JSON to a file with error handling
 * @param {string} filepath - Path to write the file
 * @param {*} data - Data to write (will be JSON.stringified)
 * @param {number} spaces - Number of spaces for formatting (default: 2)
 * @returns {boolean} True if successful, false otherwise
 */
function saveJSONFile(filepath, data, spaces = 2) {
  try {
    const content = JSON.stringify(data, null, spaces);
    fs.writeFileSync(filepath, content, 'utf8');
    return true;
  } catch (error) {
    console.error(`❌ Failed to save ${filepath}: ${error.message}`);
    return false;
  }
}

/**
 * Check if a file exists and is readable
 * @param {string} filepath - Path to check
 * @returns {boolean} True if file exists and is readable
 */
function fileExists(filepath) {
  try {
    fs.accessSync(filepath, fs.constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

module.exports = {
  loadJSONFile,
  saveJSONFile,
  fileExists
};
