/**
 * Storybook 8.4 main config -- @insurtech/shared-ui
 * Reference: task-1.4.16 Sprint 4 Phase 1
 *
 * Framework: @storybook/nextjs (Vite builder + SWC)
 * Addons: essentials, a11y, themes, interactions, chromatic
 */
import type { StorybookConfig } from '@storybook/nextjs';
import { join, dirname } from 'node:path';

function getAbsolutePath(value: string): string {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return dirname(require.resolve(join(value, 'package.json')));
}

const config: StorybookConfig = {
  stories: [
    '../src/**/*.mdx',
    '../src/**/*.stories.@(ts|tsx|mdx)',
  ],
  addons: [
    getAbsolutePath('@storybook/addon-essentials'),
    getAbsolutePath('@storybook/addon-a11y'),
    getAbsolutePath('@storybook/addon-themes'),
    getAbsolutePath('@storybook/addon-interactions'),
    getAbsolutePath('@chromatic-com/storybook'),
  ],
  framework: {
    name: getAbsolutePath('@storybook/nextjs') as '@storybook/nextjs',
    options: {
      builder: { useSWC: true },
      nextConfigPath: join(__dirname, '..', '..', '..', 'apps', 'web-broker', 'next.config.mjs'),
    },
  },
  docs: { autodocs: 'tag', defaultName: 'Documentation' },
  staticDirs: ['../public', '../src/assets'],
  typescript: {
    check: false,
    reactDocgen: 'react-docgen-typescript',
    reactDocgenTypescriptOptions: {
      shouldExtractLiteralValuesFromEnum: true,
      propFilter: (prop: { parent?: { fileName: string } }) =>
        prop.parent ? !/node_modules/.test(prop.parent.fileName) : true,
    },
  },
  features: { experimentalRSC: true },
  async viteFinal(config) {
    const { mergeConfig } = await import('vite');
    const tailwind = (await import('@tailwindcss/vite')).default;
    return mergeConfig(config, {
      plugins: [tailwind()],
      resolve: {
        alias: {
          '@': join(__dirname, '..', 'src'),
          '@insurtech/shared-ui': join(__dirname, '..', 'src'),
        },
      },
      define: {
        'process.env.NEXT_PUBLIC_APP_NAME': JSON.stringify('shared-ui-storybook'),
      },
      optimizeDeps: { include: ['react', 'react-dom'] },
    });
  },
};

export default config;
