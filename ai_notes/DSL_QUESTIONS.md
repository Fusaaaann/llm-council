Here’s a re‑ordering of the 10 questions by how directly they help solve the underlying problem (not implement the system). Earlier = more central to getting a good answer to the problem itself.

---

### 1. Problem definition & target

**(Old #1)**  
1. **What problem is this workflow trying to solve, and for whom?**  
   – State the core question or decision, and who cares about the answer.

---

### 2. Success criteria

**(Old #2)**  
2. **What does a “good” outcome look like?**  
   – Format (text, bullets, JSON, rating, options).  
   – Qualities (accurate, risk‑aware, concise, conservative, etc.).  
   – Any hard constraints (must not violate X; must always include Y).

---

### 3. Facts, inputs, and uncertainty

**(Old #3)**  
3. **What inputs and facts are available, and what is uncertain?**  
   – What the system will be given.  
   – What must be inferred, researched, or debated.

---

### 4. Decision rule under disagreement

**(Old #8)**  
4. **When perspectives disagree, how is a decision made and justified?**  
   – Who/what is the “decider” (chairman, majority vote, single expert)?  
   – Explicit decision rules (e.g., “prioritize safety over convenience”).  
   – How dissent or uncertainty should be surfaced.

---

### 5. Required perspectives/competencies

**(Old #4)**  
5. **Which distinct perspectives or competencies are needed?**  
   – e.g., “EU law”, “US law”, “security”, “business impact”.  
   – What unique value/constraints does each perspective bring?

---

### 6. Interaction / debate structure

**(Old #7)**  
6. **How do the perspectives interact to improve the answer?**  
   – Independent opinions vs back‑and‑forth debate vs refinement loops.  
   – Do agents critique each other, vote, or just provide raw inputs?

---

### 7. Process decomposition

**(Old #5)**  
7. **How should the work be broken into phases so that each phase adds clear value?**  
   – e.g., “collect views → critique/cross‑examine → synthesize decision”.  
   – For each phase: what comes in, what must come out?

---

### 8. Operational constraints

**(Old #9)**  
8. **Under what constraints must the workflow operate?**  
   – Latency (how fast it must respond).  
   – Cost (how many/which models can be used).  
   – Privacy/compliance (what must be anonymized, logged, or hidden).  
   – Reliability (acceptable failure modes, fallbacks).

---

### 9. Information visibility / sharing

**(Old #6)**  
9. **What information must be shared across phases, and what should stay hidden?**  
   – Shared memory/state vs local context.  
   – Anything that must never be exposed (PII, identities, certain inputs).

---

### 10. Outputs for audit & reuse

**(Old #10)**  
10. **What must be recorded about the outcome and reasoning, and for whom?**  
    – Final answer, rationale, risk rating, dissenting views.  
    – What needs to be auditable or reused downstream (and where it’s stored).