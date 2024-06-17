import itertools

# List of words and clues
clues = [
    {"letter": "A", "clue": "Flight-related prefix", "type": "starts", "answer": "aero"},
    {"letter": "B", "clue": "One way to be taken", "type": "contains", "answer": "aback"},
    {"letter": "C", "clue": "Not require fees to be paid", "type": "contains", "answer": "waivecharges"},
    {"letter": "D", "clue": "Giving sort", "type": "starts", "answer": "donor"},
    {"letter": "E", "clue": "Fit to serve", "type": "starts", "answer": "edible"},
    {"letter": "F", "clue": "Block number, for short?", "type": "contains", "answer": "spf"},
    {"letter": "G", "clue": "Wood flooring feature", "type": "starts", "answer": "grain"},
    {"letter": "H", "clue": "Crunchy snack", "type": "starts", "answer": "hardshelltaco"},
    {"letter": "I", "clue": "Riyadh resident", "type": "contains", "answer": "saudi"},
    {"letter": "J", "clue": "Downright misery", "type": "contains", "answer": "abjection"},
    {"letter": "K", "clue": "KO", "type": "starts", "answer": "knockout"},
    {"letter": "L", "clue": "Respond angrily", "type": "starts", "answer": "lashout"},
    {"letter": "M", "clue": "Surrounded by, redundantly", "type": "contains", "answer": "inamongst"},
    {"letter": "N", "clue": "'99 Luftballons' singer", "type": "starts", "answer": "nena"},
    {"letter": "O", "clue": "Horseshoe-shaped body of water", "type": "starts", "answer": "oxbowlake"},
    {"letter": "P", "clue": "Corporate benefit", "type": "starts", "answer": "perk"},
    {"letter": "Q", "clue": "Social protocol", "type": "contains", "answer": "etiquette"},
    {"letter": "R", "clue": "Like Venus, but not Aphrodite", "type": "starts", "answer": "roman"},
    {"letter": "S", "clue": "The 'home' in 'There's no place like home'", "type": "contains", "answer": "kansas"},
    {"letter": "T", "clue": "Remedies for blowouts", "type": "contains", "answer": "sparetires"},
    {"letter": "U", "clue": "Optimistic", "type": "starts", "answer": "upbeat"},
    {"letter": "V", "clue": "Robin Hood's carrying case", "type": "contains", "answer": "quiver"},
    {"letter": "W", "clue": "'My words fly up, my thoughts remain ___': 'Hamlet'", "type": "contains", "answer": "below"},
    {"letter": "X", "clue": "Game streamer's weapon", "type": "starts", "answer": "xbox"},
    {"letter": "Y", "clue": "Longstanding feud", "type": "contains", "answer": "rivalry"},
    {"letter": "Z", "clue": "Informal word for many", "type": "starts", "answer": "zillions"}
]

# Function to generate reveal mappings
def generate_reveal_mapping(clues):
    reveal_mapping = {}
    index = 1

    # Track used letters to ensure each letter is mapped only once
    used_letters = {clue['letter']: set() for clue in clues}

    for i, clue1 in enumerate(clues):
        word1 = clue1['answer']
        for j, clue2 in enumerate(clues):
            if i >= j:  # Avoid duplicate and self-pairing
                continue
            word2 = clue2['answer']

            for k, char1 in enumerate(word1):
                if k in used_letters[clue1['letter']]:
                    continue
                for l, char2 in enumerate(word2):
                    if l in used_letters[clue2['letter']]:
                        continue
                    if char1 == char2:
                        reveal_mapping[clue1['letter']] = {
                            "sourceLetterIndex": k,
                            "targetClueIndex": j,
                            "targetLetterIndex": l,
                            "index": index
                        }
                        reveal_mapping[clue2['letter']] = {
                            "sourceLetterIndex": l,
                            "targetClueIndex": i,
                            "targetLetterIndex": k,
                            "index": index
                        }
                        used_letters[clue1['letter']].add(k)
                        used_letters[clue2['letter']].add(l)
                        index += 1
                        break
                if k in used_letters[clue1['letter']]:
                    break  # Move to next letter in clue1 if match found

    return reveal_mapping

# Generate reveal mapping
reveal_mapping = generate_reveal_mapping(clues)

# Output the reveal mapping
import json
reveal_mapping_json = json.dumps(reveal_mapping, indent=2)
reveal_mapping_json
