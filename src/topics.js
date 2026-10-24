// The syllabus this tutor covers: the equation chapters of NCERT Classes 8, 9 and 10 (the textbooks used by
// CBSE and RBSE). Everything the prompts say about a topic comes from here, so the tutor stays in scope.
//
// kind       → how the app validates generated questions and grades answers (see validate.js)
// answerType → what the learner types: "number" (x = 6), "pair" (x = 3, y = 2), "pair-any" (any solution), "roots" (x = 2 or x = 3)

export const SUBJECT = "school algebra equations: Linear Equations in One Variable (Class 8), Linear Equations in Two Variables (Class 9), Pair of Linear Equations in Two Variables and Quadratic Equations (Class 10), following the NCERT syllabus used by CBSE and RBSE";

export const TOPICS = [
  // ---------------- Class 8 · Chapter 2: Linear Equations in One Variable ----------------
  { id: "one-step", classLevel: 8, chapter: "Linear Equations in One Variable", kind: "equation", answerType: "number", prerequisite: null,
    name: "One-step equations", forms: "x + 7 = 12, x - 4 = 9, 4x = 20, x/5 = 3",
    shape: "a single operation on x: x + b = c, x - b = c, a*x = c, or x/a = c",
    promptFormat: '"Solve: <equation>"',
    method: "Do the opposite operation on both sides (or transpose the number) so that x is alone.",
    mistakes: "Doing the operation on one side only; subtracting when the number was subtracted (sign confusion)." },
  { id: "two-step", classLevel: 8, chapter: "Linear Equations in One Variable", kind: "equation", answerType: "number", prerequisite: "one-step",
    name: "Two-step equations", forms: "3x + 5 = 20, 2x - 7 = 9, 4x + 3 = 19",
    shape: "a*x + b = c or a*x - b = c (a from 2 to 9, b and c whole numbers); also x/a + b = c is allowed",
    promptFormat: '"Solve: <equation>"',
    method: "First move the constant to the other side, then divide by the coefficient of x.",
    mistakes: "Dividing before moving the constant; forgetting to change the sign when transposing." },
  { id: "both-sides", classLevel: 8, chapter: "Linear Equations in One Variable", kind: "equation", answerType: "number", prerequisite: "two-step",
    name: "Variable on both sides", forms: "5x - 3 = 2x + 9, 7x + 4 = 3x - 8",
    shape: "a*x + b = c*x + d with x on BOTH sides, e.g. 5*x - 3 = 2*x + 9",
    promptFormat: '"Solve: <equation>"',
    method: "Collect all x terms on one side and all numbers on the other, then divide.",
    mistakes: "Sign errors when moving x terms; subtracting coefficients wrongly (5x - 2x = 3x, not 7x)." },
  { id: "brackets", classLevel: 8, chapter: "Linear Equations in One Variable", kind: "equation", answerType: "number", prerequisite: "two-step",
    name: "Equations with brackets", forms: "2(x + 3) = 16, 3(x - 4) = 2(x + 1)",
    shape: "a bracket containing x, e.g. 2*(x + 3) = 16 or 3*(x - 4) = 2*(x + 1)",
    promptFormat: '"Solve: <equation>"',
    method: "Expand the brackets by multiplying every term inside, then solve like the earlier forms.",
    mistakes: "Multiplying only the first term inside the bracket; sign errors with negatives." },
  { id: "fractions", classLevel: 8, chapter: "Linear Equations in One Variable", kind: "equation", answerType: "number", prerequisite: "two-step",
    name: "Equations with fractions", forms: "x/3 + 2 = 5, (2x + 1)/3 = 5, x/2 + x/3 = 10",
    shape: "at least one fraction involving x, e.g. x/3 + 2 = 5, (2*x + 1)/3 = 5, x/2 + x/3 = 10",
    promptFormat: '"Solve: <equation>"',
    method: "Multiply both sides by the LCM of the denominators to clear the fractions, then solve.",
    mistakes: "Multiplying only some terms by the LCM; treating (2x + 1)/3 as 2x + 1/3." },
  { id: "word-numbers", classLevel: 8, chapter: "Linear Equations in One Variable", kind: "word", answerType: "number", prerequisite: "two-step",
    name: "Word problems: numbers and ages",
    forms: "\"A number increased by 7 is 15.\"  \"Riya's father is 3 times her age; in 12 years he will be twice her age.\"",
    shape: "a 1–3 sentence story about a number or ages; the student must form and solve the equation",
    promptFormat: "a short story ending with a question such as \"Find the number.\" or \"How old is Riya?\"",
    method: "Choose the unknown as x, translate each phrase into an expression, form the equation, solve, then check the answer against the story.",
    mistakes: "Choosing the wrong unknown; translating 'less than' in the wrong order; not checking the answer makes sense." },
  { id: "word-everyday", classLevel: 8, chapter: "Linear Equations in One Variable", kind: "word", answerType: "number", prerequisite: "word-numbers",
    name: "Word problems: perimeter, money and everyday situations",
    forms: "\"The perimeter of a rectangle is 40 cm; its length is 4 cm more than its breadth.\"  \"Tickets cost 20 rupees each; after buying some, 15 rupees are left from 115.\"",
    shape: "a 1–3 sentence story about perimeter, money or an everyday quantity; the student must form and solve the equation",
    promptFormat: "a short story ending with a question that asks for ONE number",
    method: "Write what is known in terms of x, use the formula or relationship (perimeter = 2(l + b), total = price × number), form the equation and solve.",
    mistakes: "Forgetting the perimeter formula has a factor of 2; mixing units; answering the equation but not the actual question asked." },

  // ---------------- Class 9 · Chapter 4: Linear Equations in Two Variables ----------------
  { id: "two-var-value", classLevel: 9, chapter: "Linear Equations in Two Variables", kind: "two-var-value", answerType: "number", prerequisite: "two-step",
    name: "Find y for a given x", forms: "If 2x + 3y = 12, find y when x = 3.",
    shape: "a*x + b*y = c (a, b from 1 to 9) together with a value of x; the resulting y should be a whole number below advanced level",
    promptFormat: '"If <equation>, find y when x = <number>."  (exactly this wording)',
    method: "Put the given value of x into the equation, then solve the equation you get in y.",
    mistakes: "Substituting into only one term; sign errors when moving the x-term across." },
  { id: "two-var-any", classLevel: 9, chapter: "Linear Equations in Two Variables", kind: "two-var-any", answerType: "pair-any", prerequisite: "two-var-value",
    name: "Write a solution of a two-variable equation", forms: "Write any one solution of 3x + 2y = 12.",
    shape: "a*x + b*y = c with small whole-number coefficients so that whole-number solutions exist",
    promptFormat: '"Write any one solution of <equation>."  (exactly this wording)',
    method: "Choose any value for x, substitute it, solve for y; the pair (x, y) is one solution. A linear equation in two variables has infinitely many solutions.",
    mistakes: "Giving only one number instead of a pair; thinking there is only one solution." },
  { id: "two-var-word", classLevel: 9, chapter: "Linear Equations in Two Variables", kind: "two-var-word", answerType: "number", prerequisite: "two-var-value",
    name: "Word problems: two-variable equations",
    forms: "\"A pen and a notebook together cost 50 rupees. Write the equation. If the pen costs 12 rupees, what does the notebook cost?\"",
    shape: "a story with two unknowns that gives one of them and asks for the other",
    promptFormat: "a short story that names two quantities, gives the value of one, and asks for the other (ONE number)",
    method: "Let the unknowns be x and y, write the linear equation from the story, substitute the given value and solve.",
    mistakes: "Forgetting to write the equation; mixing up which quantity is given." },

  // ---------------- Class 10 · Chapter 3: Pair of Linear Equations in Two Variables ----------------
  { id: "system-solve", classLevel: 10, chapter: "Pair of Linear Equations in Two Variables", kind: "system", answerType: "pair", prerequisite: "two-var-value",
    name: "Solve a pair of linear equations", forms: "Solve: 2x + 3y = 12 and x - y = 1",
    shape: "two equations a*x + b*y = c with a unique whole-number solution below advanced level",
    promptFormat: '"Solve: <equation 1> and <equation 2>"  (exactly this wording, with the word \'and\')',
    method: "Elimination: make the coefficients of one variable equal, subtract the equations, solve, then substitute back. Substitution also works.",
    mistakes: "Sign errors when subtracting; forgetting to find the second variable; not checking both equations." },
  { id: "system-word", classLevel: 10, chapter: "Pair of Linear Equations in Two Variables", kind: "system-word", answerType: "pair", prerequisite: "system-solve",
    name: "Word problems: pair of equations",
    forms: "\"Two numbers add up to 30 and differ by 6. Find the numbers.\"  \"5 pens and 3 pencils cost 35 rupees; 2 pens and 3 pencils cost 23 rupees. Find the cost of each.\"",
    shape: "a story with two unknowns and two facts, asking for both unknowns",
    promptFormat: "a short story with two facts, ending with a question for BOTH unknowns (the larger/first quantity is x)",
    method: "Let the unknowns be x and y, write one equation per fact, then solve the pair by elimination or substitution.",
    mistakes: "Writing only one equation; swapping which unknown is x; arithmetic slips in elimination." },

  // ---------------- Class 10 · Chapter 4: Quadratic Equations ----------------
  { id: "quad-solve", classLevel: 10, chapter: "Quadratic Equations", kind: "quadratic", answerType: "roots", prerequisite: "brackets",
    name: "Solve a quadratic equation", forms: "Solve: x² - 5x + 6 = 0, Solve: x² + 2x - 15 = 0, Solve: 2x² - 7x + 3 = 0",
    shape: "a*x^2 + b*x + c = 0 that factorises; two distinct real roots, whole numbers below advanced level",
    promptFormat: '"Solve: <quadratic> = 0"  (write x² in the prompt and x^2 in the machine equation)',
    method: "Factorise: find two numbers whose product is a*c and whose sum is b, split the middle term, then set each factor to zero. Or use the quadratic formula.",
    mistakes: "Giving only one root; sign errors in the factors; forgetting to divide by the coefficient of x²." },
  { id: "quad-word", classLevel: 10, chapter: "Quadratic Equations", kind: "quadratic-word", answerType: "number", prerequisite: "quad-solve",
    name: "Word problems: quadratic equations",
    forms: "\"The product of two consecutive positive integers is 56. Find the smaller integer.\"  \"A rectangle's length is 3 m more than its breadth and its area is 40 m². Find the breadth.\"",
    shape: "a story leading to a quadratic equation whose valid root is a positive whole number",
    promptFormat: "a short story ending with a question for ONE number (reject the root that does not fit the story)",
    method: "Form the quadratic equation from the story, solve it, and reject the root that does not make sense (negative length, age or count).",
    mistakes: "Keeping the negative root; forming the equation with the wrong relationship." },
];

export const TOPIC_IDS = TOPICS.map((t) => t.id);
export const CLASS_LEVELS = [...new Set(TOPICS.map((t) => t.classLevel))];
export const LEVELS = ["beginner", "intermediate", "advanced"];
export const MODES = ["learn", "practice", "quiz", "doubt"];

/** Topic that builds the skill this one relies on (null for the first topic). Always earlier in syllabus order. */
export function prerequisiteOf(id) {
  return getTopic(id)?.prerequisite ?? null;
}

export function getTopic(id) {
  return TOPICS.find((t) => t.id === id) || null;
}
