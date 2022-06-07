import svgrCore from "@svgr/core";
import { transform } from "esbuild";
import fs from "fs-extra";
import path from "path";
import type { Plugin } from "rollup";

export function svgr({
  exportedComponentName,
  alias = {},
}: {
  exportedComponentName: string;
  alias?: Record<string, string>;
}): Plugin {
  return {
    name: "vite-plugin-react-svgr",
    async transform(code, id) {
      if (!id.endsWith(".svg")) {
        return;
      }
      // ID can either be an absolute path (when SVG is imported with
      // ./logo.svg) or a relative path (when SVG is imported through an
      // alias like foo/logo.svg).
      let absoluteFilePath = id;
      for (const [mapFrom, mapTo] of Object.entries(alias)) {
        const matchStart = path.join(path.sep, mapFrom);
        if (id.startsWith(matchStart)) {
          absoluteFilePath = path.join(mapTo, path.relative(matchStart, id));
        }
      }
      let componentCode: string;
      if (await fs.pathExists(absoluteFilePath)) {
        const svg = await fs.readFile(absoluteFilePath, "utf8");
        const generatedSvgrCode: string = await svgrCore.transform(
          svg,
          {},
          { componentName: "ReactComponent" }
        );
        componentCode = generatedSvgrCode.replace(
          "export default ReactComponent",
          `export { ReactComponent as ${exportedComponentName} }`
        );
      } else {
        componentCode = `
import React from 'react';

const ReactComponent = () => <div>
  Unable to resolve ${id}
</div>;

export { ReactComponent as ${exportedComponentName} }
        `;
      }
      const res = await transform(
        (exportedComponentName !== "default" ? code : "") +
          "\n" +
          componentCode,
        {
          sourcefile: absoluteFilePath,
          loader: "jsx",
        }
      );
      return {
        code: res.code,
      };
    },
  };
}
