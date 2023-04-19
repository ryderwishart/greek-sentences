import fs from 'fs/promises';
import path from 'path';
import { odonnell_corpus, hellenistic_corpus } from '../../public/corpora';
import metaDataArray from '../../public/data/hellenistic_author_metadata.json';

console.log('loading api ...');
const metaDataDict = metaDataArray.reduce((acc, obj) => {
  acc[`${obj.authorId}_${obj.workId}`] = obj;
  return acc;
}, {});

const hellenistic_author_ids = new Set(hellenistic_corpus.map(entry => entry.id));
const odonnell_corpus_pairs = new Set(odonnell_corpus.map(entry => `${entry.authorId}_${entry.workId}`));
const hellenistic_author_dict = Object.fromEntries(hellenistic_corpus.map(entry => [entry.id, entry]));
const odonnell_corpus_dict = Object.fromEntries(odonnell_corpus.map(entry => [`${entry.authorId}_${entry.workId}`, entry]));
const dataPath = '../../public/data/json_sentence_pairs';

async function* readFromJsonFiles(searchTerms, use_odonnell_corpus) {
  const dataPath = path.join(process.cwd(), 'public/data/json_sentence_pairs');
  // console.log({ dirname: __dirname, joined: path.join(__dirname, dataPath) });
  // const jsonPath = path.join(__dirname, dataPath);
  const jsonPath = dataPath
  const jsonFiles = await fs.readdir(jsonPath);
  // console.log({ jsonFiles })

  for (const file of jsonFiles) {
    if (file.endsWith('.json')) {
      const [author_id, work_id] = file.split('.').slice(0, 2).map(id => id.slice(3));
      if (!hellenistic_author_ids.has(author_id) ||
        (use_odonnell_corpus && !odonnell_corpus_pairs.has(`${author_id}_${work_id}`))) {
        continue;
      }

      // Get metadata if it exists
      const metadata = metaDataDict[`${author_id}_${work_id}`];

      // Retrieve the author object
      const author = hellenistic_author_dict[author_id];
      const odonnell_work = use_odonnell_corpus ? odonnell_corpus_dict[`${author_id}_${work_id}`] : null;

      const content = await fs.readFile(path.join(jsonPath, file), 'utf8');
      let objects = [];
      try {
        objects = JSON.parse(content);
      } catch (e) {
        console.log('error parsing json', e, file);
      }
      for (const obj of objects) {
        if (Object.keys(obj).length > 0) {
          const { tokens, lemmas } = obj;

          if (!tokens || !lemmas) {
            console.log('missing tokens or lemmas', obj);
            continue;
          }
          for (const term of searchTerms) {
            const termNoAccentsLower = term.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
            const tokensNoAccentsLower = tokens.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
            const lemmasNoAccentsLower = lemmas.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
            if (tokensNoAccentsLower.includes(termNoAccentsLower) || lemmasNoAccentsLower.includes(termNoAccentsLower)) {
              // Add the author object to the result
              obj.metadata = { ...metadata, ...author };
              if (odonnell_work) {
                obj.odonnell_work = odonnell_work;
              }
              // console.log('found', term, obj);
              yield obj;
              break;
            }
          }
        }
      }
    }
  }
}

console.log('api loaded');

// Define the API endpoint handler
// eslint-disable-next-line import/no-anonymous-default-export
export default async (req, res) => {
  // start timer
  const start = Date.now();

  const { query, use_odonnell_corpus } = req.query;

  console.log({ query, use_odonnell_corpus })
  if (!query) {
    return res.status(400).json({ error: 'Query string parameter "query" is required.' });
  }

  const searchTerms = Array.isArray(query) ? query : [query];
  const useOdonnellCorpus = use_odonnell_corpus === 'true';
  const results = [];

  for await (const item of readFromJsonFiles(searchTerms, useOdonnellCorpus)) {
    results.push(item);
  }

  res.status(200).json({
    count: results.length,
    // format time as seconds to two decimal places
    time: (Date.now() - start) / 1000,
    results
  });
};
