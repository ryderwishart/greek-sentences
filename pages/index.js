import { useState } from 'react';
import Head from 'next/head';
import Image from 'next/image';
import { Inter } from 'next/font/google';
import styles from '@/styles/Home.module.css';
import lemmasAndTokens from '../public/data/lemmas_and_tokens_by_frequency.json';
import InfiniteScroll from 'react-infinite-scroll-component';

const dev = process.env.NODE_ENV !== 'production';

export const server = dev
  ? 'http://localhost:3000'
  : 'https://greek-sentences.vercel.app';

const inter = Inter({ subsets: ['latin'] });

function latinToGreek(input) {
  const latinToGreekMap = {
    // Add Latin to Greek character mappings here
    'a': 'α',
    'b': 'β',
    'g': 'γ',
    'd': 'δ',
    'e': 'ε',
    'z': 'ζ',
    'h': 'η',
    'q': 'θ',
    'i': 'ι',
    'k': 'κ',
    'l': 'λ',
    'm': 'μ',
    'n': 'ν',
    'c': 'ξ',
    'o': 'ο',
    'p': 'π',
    'r': 'ρ',
    // 's' maps to 'σ' and 'ς', so when we map 's' to 'σ', we need to replace 'ς' in the input string with 'σ'
    's': 'σ',
    't': 'τ',
    'u': 'υ',
    'f': 'φ',
    'y': 'ψ',
    'w': 'ω',
    'j': 'ϗ',
    'v': 'Ϝ',
    'x': 'χ',
  };
  // let cleanedInput = input.replace(/ς/g, 'σ');
  // actually, only replace sigma with final sigma if it's the last character in the word (followed by a space or punctuation, or the end of the string) - cannot use \b to match the end of the string
  console.log('input', input)
  let cleanedInput = input.replace(/σ(?=[\s.,;:!?])/g, 'ς');
  console.log('cleanedInput', cleanedInput)
  return cleanedInput.split('').map(char => latinToGreekMap[char] || char).join('');
}

export default function Home() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [useOdonnellCorpus, setUseOdonnellCorpus] = useState(false);
  const [suggestions, setSuggestions] = useState([]);

  const handleInputChange = (event) => {
    const inputValue = latinToGreek(event.target.value);
    setQuery(inputValue);

    // Get the last token (word) from the input
    const lastToken = inputValue
      .split(/[\s.,;:!?]+/)
      .filter(Boolean)
      .pop() || '';

    // Normalize lastToken and filter the suggestions
    const normalizedLastToken = lastToken.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const filteredSuggestions = lemmasAndTokens
      .map(([lemmaOrToken]) => lemmaOrToken)
      .filter((lemmaOrToken) =>
        lemmaOrToken
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .includes(normalizedLastToken),
      )
      .slice(0, 20);

    setSuggestions(filteredSuggestions);
  };

  const downloadCSV = () => {
    /*
    filename: "tlg0527.tlg005.opp-grc2"
    id: 473645
    lemmas: "καί πᾶς ὁ  αὐτός  εἰς ὁ δίοδος αὐτός , καί  ὁ πόλις ἐν πῦρ καί πᾶς ὁ σκῦλον αὐτός πανδημεί   ὁ θεός  ·"
    metadata: {
      author: "Septuaginta"
      authorId: "0527"
      authorWorkId: "tlg0527.tlg005"
      centuryOfAuthorLifetime: "300 BCE-300 CE"
      dateRangeOfWork: "300 BCE-300 CE"
      genre: "Bible\\Historical Texts\\Religious Texts\\Legal texts"
      geographicLocation: "Alexandria, Egypt"
      id: "0527"
      name: "SEPTUAGINTA"
      notes: null
      tags: "Relig."
      urn: "urn:cts:greekLit:tlg0527.tlg005.opp-grc2"
      workId: "005"
      workTitle: "Deuteronomium↵"
    }
    tokens: "καὶ πάντα 
    */
    const headers = ['id', 'filename', 'author', 'authorId', 'authorWorkId', 'centuryOfAuthorLifetime', 'dateRangeOfWork', 'genre', 'geographicLocation', 'name', 'notes', 'tags', 'urn', 'workId', 'workTitle', 'tokens', 'lemmas'];
    const csvContent = [headers, ...results.results.map((result) => [
      result.id,
      result.metadata.filename,
      result.metadata.author,
      result.metadata.authorId,
      result.metadata.authorWorkId,
      result.metadata.centuryOfAuthorLifetime,
      result.metadata.dateRangeOfWork,
      result.metadata.genre,
      result.metadata.geographicLocation,
      result.metadata.name,
      result.metadata.notes,
      result.metadata.tags,
      result.metadata.urn,
      result.metadata.workId,
      result.metadata.workTitle,
      result.tokens,
      result.lemmas,
    ])]
      .map((row) => row.join(','))
      .join('\n');
    const csvBlob = new Blob([csvContent], { type: 'text/csv' });
    const csvUrl = URL.createObjectURL(csvBlob);
    const link = document.createElement('a');
    link.href = csvUrl;
    link.download = `${query}_search-results.csv`;
    link.click();
    URL.revokeObjectURL(csvUrl);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);

    let url = `${server}/api/search?`;
    // Split on commas and trim whitespace.
    const terms = query.split(',').map((term) => term.trim());
    // Loop through the terms and encode each one and add it to the URL.
    terms.forEach((term, index) => {
      // replace whitespace with %20, but keep unicode greek characters intact
      const encodedTerm = term.replace(/ /g, '%20')
      url += `query=${encodedTerm}`;
      if (index < terms.length - 1) {
        url += '&';
      }
    });

    // If use_odonnell is checked, add it to the URL.
    if (useOdonnellCorpus) {
      url += '&useOdonnellCorpus=true';
    }

    // Fetch the results and handle them as needed.
    console.log({ url })
    const response = await fetch(url);
    const results = await response.json()
    console.log(results);
    setResults(results || ['No results found']);
    setLoading(false);
  };

  return (
    <>
      <>
        <Head>
          <title>Greek Sentences</title>
          <meta name="description" content="Generated by create next app" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <link rel="icon" href="/favicon.ico" />
        </Head>
        <main className={styles.main}>
          <div className={styles.description}>

            {/* <Image
              className={styles.logo}
              src="/next.svg"
              alt="Next.js Logo"
              width={180}
              height={37}
              priority
            /> */}
            <h1 className={inter.className}>
              Search Greek Sentences
            </h1>
            <form onSubmit={handleSubmit} className={styles.searchForm}>
              <div className={styles.searchInputWrapper}>
                <input
                  type="text"
                  value={query}
                  onChange={handleInputChange}
                  placeholder="Enter a search term"
                  onBlur={() => setTimeout(() => setSuggestions([]), 100)}
                />
                {suggestions.length > 0 && (
                  <ul className={styles.suggestionsList}>
                    {suggestions.map((suggestion, index) => (
                      <li
                        key={index}
                        onClick={() => {
                          const tokens = query.split(/([\s.,;:!?]+)/);
                          tokens[tokens.length - 1] = suggestion;
                          setQuery(tokens.join(''));
                          setSuggestions([]);
                        }}
                      >
                        {suggestion}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <button type="submit">Search</button>
              <button onClick={downloadCSV} disabled={results.length === 0}>
                💾
              </button>
              <div className={styles.oneHundredPercentFlexBasisRowItem} />
              <label
                htmlFor="use_odonnell"
              >
                Limit Corpus to O&apos;Donnell Corpus Only
                <input
                  type="checkbox"
                  id="use_odonnell"
                  name="use_odonnell"
                  checked={useOdonnellCorpus}
                  onChange={() => setUseOdonnellCorpus(!useOdonnellCorpus)}
                />
              </label>
              {
                results.length > 0 &&
                <p>{results.length} results found</p>
              }
            </form>
          </div>
          {
            results.count > 0 &&
            <div className={styles.status}>
              Number of hits:
              <span>
                {results.count}
              </span> in
              <span> {results.time} seconds</span>
            </div>
          }
          {
            <InfiniteScroll
              dataLength={results.length}
              next={() => { }}
              hasMore={false}
              loader={loading ? <h4>Loading...</h4> : null}
              endMessage={query ? <div className={styles.status}>All results displayed.</div> : <></>}
              className={styles.grid}
            >
              {
                results.results &&
                <div className={styles.metadataRow}>
                  <p className={inter.className}>Author: Title of work</p>
                  <p className={inter.className}>Location</p>
                  <p className={inter.className}>Date range of work or author</p>
                  <p className={inter.className}>Genre</p>
                  <p className={inter.className}>Categories</p>
                </div>
              }
              {/* Example result: {"id":36218,"filename":"tlg1443.tlg005.1st1K-grc1","tokens":"εἰ γὰρ μέχρι νῦν κατὰ Ἰουδαῖσμὸν ζῶμεν, ὁμολογοῦμεν χάριν μὴ εἰληφέναι.","lemmas":"εἰ γάρ μέχρι νῦν κατά ζήω , ὁμολογέω χάρις μή λαμβάνω .","metadata":{"author":"Ignatius Antiochenus\n","geographicLocation":"Antakya, Hatay Province, Turkey","centuryOfAuthorLifetime":"35 CE-108 CE","workTitle":"Ad Magnesios (epist. 2)","dateRangeOfWork":"80 CE-100 CE","urn":"urn:cts:greekLit:tlg1443.tlg005.1st1K-grc1","genre":"Epistles","notes":null,"authorWorkId":"tlg1443.tlg005","authorId":"1443","workId":"005","name":"IGNATIUS","tags":"Scr. Eccl.","id":"1443"}} */}
              {results.results && results.results.map((result, index) => (
                <a className={styles.card} key={index + result.filename}>
                  {/* {JSON.stringify(result)} */}
                  <div className={styles.metadataRow}>
                    <p className={inter.className}>{result.metadata.author}: {result.metadata.workTitle}</p>
                    <p className={inter.className}>{result.metadata.geographicLocation}</p>
                    <p className={inter.className}>{result.metadata.dateRangeOfWork}</p>
                    <p className={inter.className}>{result.metadata.genre}</p>
                    <p className={inter.className}>{result.metadata.tags}</p>
                  </div>
                  <span className={styles.textContent}>{result.tokens}</span>
                  {/* <p className={inter.className}>{result.metadata.author} - {result.metadata.workTitle}</p> */}
                </a>
              ))}
            </InfiniteScroll>
          }
          <div className={styles.description}>
            <p className={inter.className}>
              Search for Greek sentences containing a given word.
              Multiple search terms should be separated by a comma.
              For example, &quot;ἀγαθός, ἀγαθότης&quot; will return
              sentences containing either ἀγαθός or ἀγαθότης, or both,
              but &quot;ἀγαθός ἀγαθότης&quot; will return sentences
              containing ἀγαθός ἀγαθότης exactly. Accents and breathing
              marks are stripped from the search terms. The number
              of hits is accurate, but only a max of 500 sentences will
              be returned. If you are getting that many results, refine
              your search a bit. If you need more than that, contact Ryder.
            </p>
          </div>
          {loading && (
            <div className={styles.loadingOverlay}>
              <div className={styles.spinner}></div>
            </div>
          )}
        </main>
      </>
    </>
  );
}
