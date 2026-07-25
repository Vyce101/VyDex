// Runs repository-local npm commands with captured output across supported operating systems.
import { spawn } from "node:child_process";

export type NpmCommandResult = {
  exit_code: number;
  output: string;
};

export async function runNpmCommand(input: {
  command_arguments: string[];
  working_directory: string;
  environment: NodeJS.ProcessEnv;
}): Promise<NpmCommandResult> {
  const npmExecPath = input.environment.npm_execpath?.trim();
  if (!npmExecPath) {
    throw new Error("npm_execpath is unavailable; run the Stage 1 release through an npm script.");
  }

  const nodeExecutable = input.environment.npm_node_execpath?.trim() || process.execPath;
  return new Promise((complete, reject) => {
    const child = spawn(nodeExecutable, [npmExecPath, ...input.command_arguments], {
      cwd: input.working_directory,
      env: input.environment,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let output = "";
    child.stdout.on("data", (chunk) => {
      output += String(chunk);
    });
    child.stderr.on("data", (chunk) => {
      output += String(chunk);
    });
    child.on("error", reject);
    child.on("close", (code) => complete({ exit_code: code ?? 1, output }));
  });
}
