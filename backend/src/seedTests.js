import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const tests = [
  {
    id: 'test-python-001',
    title: 'Python',
    description: 'Fundamentals of Python programming language',
    duration: 10,
    questions: [
      { text: 'What keyword is used to define a function in Python?', options: ['def', 'function', 'func', 'define'], answer: '0' },
      { text: 'What is the output of `2 ** 3` in Python?', options: ['6', '8', '9', '16'], answer: '1' },
      { text: 'Which of these is an immutable data type in Python?', options: ['list', 'dict', 'tuple', 'set'], answer: '2' },
      { text: 'What does `len([1, 2, 3, 4])` return?', options: ['3', '4', '5', '2'], answer: '1' },
      { text: 'Which method removes and returns the last element from a list?', options: ['remove()', 'delete()', 'pop()', 'discard()'], answer: '2' },
      { text: 'What is the correct way to create an empty dictionary?', options: ['d = []', 'd = {}', 'd = ()', 'd = set()'], answer: '1' },
      { text: 'Which of these is NOT a valid Python built-in type?', options: ['int', 'float', 'char', 'bool'], answer: '2' },
      { text: 'What does `range(1, 5)` produce?', options: ['[1,2,3,4,5]', '[1,2,3,4]', '[0,1,2,3,4]', '[2,3,4,5]'], answer: '1' },
      { text: 'How do you start a single-line comment in Python?', options: ['//', '/*', '#', '--'], answer: '2' },
      { text: "What is the output of `'hello'[1:3]`?", options: ['hel', 'el', 'ell', 'he'], answer: '1' },
    ]
  },
  {
    id: 'test-java-001',
    title: 'Java',
    description: 'Core Java programming concepts',
    duration: 10,
    questions: [
      { text: 'Which keyword is used to inherit a class in Java?', options: ['implements', 'extends', 'inherits', 'super'], answer: '1' },
      { text: 'What is the default value of an int variable in Java?', options: ['null', 'undefined', '0', '1'], answer: '2' },
      { text: 'Which of the following is NOT a Java primitive type?', options: ['int', 'float', 'String', 'boolean'], answer: '2' },
      { text: 'What does JVM stand for?', options: ['Java Virtual Machine', 'Java Visual Mode', 'Java Variable Manager', 'Java Verification Module'], answer: '0' },
      { text: 'Which method is the entry point of a Java program?', options: ['start()', 'init()', 'main()', 'run()'], answer: '2' },
      { text: 'Which collection class allows duplicate elements?', options: ['HashSet', 'TreeSet', 'LinkedHashSet', 'ArrayList'], answer: '3' },
      { text: 'What does the `final` keyword do to a variable?', options: ['Makes it thread-safe', 'Makes it null', 'Makes it constant', 'Makes it static'], answer: '2' },
      { text: 'Which exception is thrown when dividing by zero in integer Java?', options: ['NullPointerException', 'ArithmeticException', 'IllegalArgumentException', 'NumberFormatException'], answer: '1' },
      { text: 'What is the size of an int in Java?', options: ['16 bits', '32 bits', '64 bits', '8 bits'], answer: '1' },
      { text: 'Which access modifier makes a member accessible only within the same class?', options: ['public', 'protected', 'default', 'private'], answer: '3' },
    ]
  },
  {
    id: 'test-sql-001',
    title: 'SQL',
    description: 'SQL database querying and design',
    duration: 10,
    questions: [
      { text: 'Which SQL statement is used to retrieve data from a table?', options: ['GET', 'FETCH', 'SELECT', 'RETRIEVE'], answer: '2' },
      { text: 'What does the GROUP BY clause do?', options: ['Sorts results', 'Filters rows', 'Groups rows with the same values', 'Joins tables'], answer: '2' },
      { text: 'Which JOIN returns all rows from both tables, including unmatched rows?', options: ['INNER JOIN', 'LEFT JOIN', 'RIGHT JOIN', 'FULL OUTER JOIN'], answer: '3' },
      { text: 'What is a PRIMARY KEY?', options: ['A foreign key reference', 'A unique identifier for each row', 'An index on a column', 'A NOT NULL constraint'], answer: '1' },
      { text: 'Which aggregate function counts the number of rows?', options: ['SUM()', 'AVG()', 'COUNT()', 'MAX()'], answer: '2' },
      { text: 'What does the DISTINCT keyword do in a SELECT statement?', options: ['Sorts results', 'Removes duplicate rows from results', 'Filters NULL values', 'Limits the row count'], answer: '1' },
      { text: 'Which clause is used to filter results after GROUP BY?', options: ['WHERE', 'HAVING', 'FILTER', 'LIMIT'], answer: '1' },
      { text: 'What is the purpose of a FOREIGN KEY?', options: ['Makes a column unique', 'Links rows in two tables', 'Prevents null values', 'Creates an index'], answer: '1' },
      { text: 'Which command removes all rows from a table but keeps the structure?', options: ['DROP TABLE', 'DELETE FROM table (no WHERE)', 'TRUNCATE TABLE', 'REMOVE FROM'], answer: '2' },
      { text: 'What does ORDER BY do in a SQL query?', options: ['Filters rows', 'Groups rows', 'Sorts the result set', 'Joins tables'], answer: '2' },
    ]
  },
  {
    id: 'test-javascript-001',
    title: 'JavaScript',
    description: 'JavaScript language features and fundamentals',
    duration: 10,
    questions: [
      { text: 'What does `typeof null` return in JavaScript?', options: ['null', 'undefined', 'object', 'number'], answer: '2' },
      { text: 'Which method adds an element to the end of an array?', options: ['push()', 'append()', 'add()', 'insert()'], answer: '0' },
      { text: 'Which keywords declare a block-scoped variable in JavaScript?', options: ['var only', 'let only', 'const only', 'Both let and const'], answer: '3' },
      { text: 'What does `===` check in JavaScript?', options: ['Value only', 'Type only', 'Both value and type', 'Reference equality'], answer: '2' },
      { text: 'What is the output of `0.1 + 0.2 === 0.3` in JavaScript?', options: ['true', 'false', 'undefined', 'NaN'], answer: '1' },
      { text: 'Which method converts a JSON string to a JavaScript object?', options: ['JSON.stringify()', 'JSON.parse()', 'JSON.convert()', 'JSON.decode()'], answer: '1' },
      { text: 'What does `Array.prototype.map()` return?', options: ['A filtered array', 'A new transformed array', 'The original modified array', 'A boolean'], answer: '1' },
      { text: 'What is event bubbling in JavaScript?', options: ['Events fire from parent to child', 'Events propagate from child up to parent', 'Event cancellation', 'Async event handling'], answer: '1' },
      { text: 'Which of these is NOT a falsy value in JavaScript?', options: ['0', '""', 'null', '"false"'], answer: '3' },
      { text: 'What does `Promise.all([p1, p2])` do?', options: ['Runs promises one by one', 'Resolves when all promises resolve', 'Resolves when any one resolves', 'Cancels all promises'], answer: '1' },
    ]
  },
  {
    id: 'test-dsa-001',
    title: 'Data Structures',
    description: 'Data Structures and Algorithms fundamentals',
    duration: 10,
    questions: [
      { text: 'What is the time complexity of binary search?', options: ['O(n)', 'O(n²)', 'O(log n)', 'O(n log n)'], answer: '2' },
      { text: 'Which data structure follows Last In First Out (LIFO)?', options: ['Queue', 'Stack', 'Linked List', 'Tree'], answer: '1' },
      { text: 'What is the worst-case time complexity of QuickSort?', options: ['O(n log n)', 'O(n²)', 'O(n)', 'O(log n)'], answer: '1' },
      { text: 'Which tree traversal visits the root node first?', options: ['Inorder', 'Postorder', 'Preorder', 'Level order'], answer: '2' },
      { text: 'What is the average time complexity of lookup in a hash table?', options: ['O(n)', 'O(log n)', 'O(1)', 'O(n²)'], answer: '2' },
      { text: 'What is the time complexity of inserting at the beginning of a singly linked list?', options: ['O(n)', 'O(n log n)', 'O(1)', 'O(log n)'], answer: '2' },
      { text: "Which algorithm finds the shortest path in a weighted graph?", options: ['DFS', 'BFS', "Dijkstra's", 'Bubble Sort'], answer: '2' },
      { text: 'In a balanced BST, the height difference between left and right subtrees is at most:', options: ['0', '1', '2', 'Unlimited'], answer: '1' },
      { text: 'What is dynamic programming primarily used for?', options: ['Parallel computing', 'Solving overlapping subproblems efficiently', 'Memory management', 'Graph drawing'], answer: '1' },
      { text: 'What is the space complexity of merge sort?', options: ['O(1)', 'O(log n)', 'O(n)', 'O(n²)'], answer: '2' },
    ]
  }
];

async function main() {
  const hr = await prisma.user.findFirst({ where: { role: 'HR' } });
  if (!hr) { console.error('No HR user found. Run npm run db:seed first.'); process.exit(1); }

  let created = 0;
  for (const t of tests) {
    const existing = await prisma.test.findUnique({ where: { id: t.id } });
    if (existing) { console.log(`  ⏭  Skipped (already exists): ${t.title}`); continue; }

    await prisma.test.create({
      data: {
        id: t.id,
        title: t.title,
        description: t.description,
        duration: t.duration,
        createdById: hr.id,
        questions: {
          create: t.questions.map((q, i) => ({
            text: q.text,
            type: 'MCQ',
            options: JSON.stringify(q.options),
            answer: q.answer,
            order: i
          }))
        }
      }
    });
    console.log(`  ✅ Created: ${t.title} (10 questions, 10 min)`);
    created++;
  }

  console.log(`\nDone — ${created} test(s) created, ${tests.length - created} skipped.`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
