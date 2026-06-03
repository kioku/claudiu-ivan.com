import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

interface PlaygroundProject {
  readonly id: string;
  readonly title: string;
  readonly run: () => Promise<void>;
}

const projects: readonly PlaygroundProject[] = [
  {
    id: "data-access-with-lenses",
    title: "Data Access with Lenses",
    run: async () => {
      await import("./data-access-with-lenses/index.ts");
    },
  },
];

function printProjects(): void {
  console.log("Available playground projects:\n");
  projects.forEach((project, index) => {
    console.log(`${index + 1}. ${project.title} (${project.id})`);
  });
  console.log("");
}

function findProject(selection: string): PlaygroundProject | undefined {
  const trimmedSelection = selection.trim();
  const selectedIndex = Number(trimmedSelection) - 1;

  if (Number.isInteger(selectedIndex) && projects[selectedIndex]) {
    return projects[selectedIndex];
  }

  return projects.find((project) => project.id === trimmedSelection);
}

async function promptForSelection(): Promise<string> {
  printProjects();

  const rl = readline.createInterface({ input, output });
  try {
    return await rl.question("Select a project to run: ");
  } finally {
    rl.close();
  }
}

async function selectProject(): Promise<PlaygroundProject> {
  const selection = process.argv[2] ?? (await promptForSelection());
  const project = findProject(selection);

  if (!project) {
    throw new Error(`Unknown playground project: ${selection}`);
  }

  return project;
}

const project = await selectProject();
console.log(`\nRunning ${project.title}...\n`);
await project.run();
