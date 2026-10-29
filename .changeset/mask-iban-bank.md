---
"@virastack/mask": minor
---

Add `getTurkishBank(iban)` and `turkishBanks`: the bank behind a Turkish IBAN,
read from its bank code, with the full list of TCMB payment system participants
(70, last change 18.09.2026). It answers as soon as the bank digits are typed,
works with spaces and lowercase, and is on the `/server` entry too. The table is
a plain literal, so bundles that never call it do not grow.
