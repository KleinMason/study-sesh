'use strict';
const fs = require('node:fs');

const SUPPORTED_VERSION = 1;

function loadBank(syllabusPath) {
  if (!fs.existsSync(syllabusPath)) {
    throw new Error(`No concept bank at ${syllabusPath}`);
  }
  let bank;
  try {
    bank = JSON.parse(fs.readFileSync(syllabusPath, 'utf8'));
  } catch (err) {
    throw new Error(`concept bank is not valid JSON: ${err.message}`);
  }
  if (bank.version !== SUPPORTED_VERSION) {
    throw new Error(`unsupported concept bank version: ${bank.version}`);
  }
  if (!Array.isArray(bank.categories) || bank.categories.length === 0) {
    throw new Error('concept bank has no categories');
  }

  const seenCategories = new Set();
  const seenConcepts = new Set();
  for (const category of bank.categories) {
    if (!category.id || !category.name) {
      throw new Error('every category needs an id and a name');
    }
    if (seenCategories.has(category.id)) {
      throw new Error(`duplicate category id: ${category.id}`);
    }
    seenCategories.add(category.id);

    if (!Array.isArray(category.concepts) || category.concepts.length === 0) {
      throw new Error(`category ${category.id} has no concepts`);
    }
    for (const concept of category.concepts) {
      if (!concept.id || !concept.name) {
        throw new Error(`every concept in ${category.id} needs an id and a name`);
      }
      if (seenConcepts.has(concept.id)) {
        throw new Error(`duplicate concept id: ${concept.id}`);
      }
      seenConcepts.add(concept.id);
    }
  }
  return bank;
}

function allConceptIds(bank) {
  const ids = new Set();
  for (const category of bank.categories) {
    for (const concept of category.concepts) ids.add(concept.id);
  }
  return ids;
}

function findConcept(bank, conceptId) {
  for (const category of bank.categories) {
    for (const concept of category.concepts) {
      if (concept.id === conceptId) return { category, concept };
    }
  }
  return null;
}

module.exports = { loadBank, allConceptIds, findConcept, SUPPORTED_VERSION };
