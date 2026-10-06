# Publishing promptcost

Everything the repository needs to exist on GitHub, written down before the
repository is created so that creating it is a transcription rather than a
series of small decisions taken at the API.

Written at tick 217, three days after the date `D15` gave this project, because
no file said what the About box should contain. The workflow was already in the
tree.

## The About box

**Description**, 350 characters or fewer, and it has to carry the number:

> A real contract, priced against a real price list. The heatmap the brief asked
> for shows where the tokens are, and the measurement underneath argues that it
> is the wrong picture: the dense clauses are not the expensive ones, because
> length and price are the same axis twice. Both are on the page.

**Homepage**: `https://broikos-nikos.github.io/promptcost/`

**Topics**, ten, the maximum GitHub shows without a fold:

```
llm  tokenizer  cost-analysis  pricing  legal-tech  data-visualization
reproducible-research  typescript  nlp  heatmap
```

`cost-analysis` and `pricing` are the two that matter. Somebody who has been
handed a per million token price and a document and asked what it will cost is
searching one of them, and the thing nobody else has published is the argument
against the artefact: the heatmap is drawn and then shown to be the wrong tool
for the question, with the measurement that says so.

`legal-tech` is there because the input is a contract, and that is the audience
that has this problem first.

## Settings

- **Public**, no wiki, no projects, no discussions. Issues on: a repository
  whose headline is an argument against its own picture should be reachable by
  somebody who thinks the argument is wrong.
- **Pages**: source GitHub Actions, not a branch. The workflow builds, gates
  and deploys, and a branch source would publish whatever was committed
  regardless of whether the gates passed. `check:density` rebuilds every
  document from the hashed contract and the hashed price list, so a branch
  source would let a page priced on a file nobody has reach a reader.
- **No default community files.** The MIT LICENSE is committed already, and
  `check:licence` fails if the README claims a licence the tree does not carry.

## The order, and why this order

1. **Create the repository** with the description, homepage and topics above, so
   the About box is never empty. `watch-it-think` shipped with an empty one and
   a recruiter audit filed it as a high finding: the ten second screen had no
   sentence on it.
2. **Push `main` with the whole history**, every commit authored
   `Nikos Broikos <broikos.nikolaos@gmail.com>`, none co-authored. The root
   commit was split into four at tick 214, because seven of the thirteen rows in
   the file list carried one subject and that column is the whole first screen
   on a phone. The tree hash was identical afterwards.
3. **Turn Pages on** and let the workflow run. Nothing is deployed by hand.
4. **Wait for the deploy, then open the live URL in a browser and look at it.**
   A green deploy is not a working page.
5. **Put the live link in the first screen of the README**, above the picture.

## What the inputs are, and why they are committed

`data/contract.md` and `data/pricing.json` are both in the tree and both
hashed, which is the difference between this and most cost calculators: the
number on the page can be rebuilt from the two files next to it with
`npm run build:density`. `check:density` recomputes it on every build and
`check-clone-hashes.mjs` in the workspace holds the hash to what a fresh clone
produces, because the first version of that hash was computed on the bytes and
disagreed with itself across a line ending.
