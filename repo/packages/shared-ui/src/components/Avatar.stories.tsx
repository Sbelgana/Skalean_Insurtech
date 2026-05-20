/**
 * Avatar stories -- CSF v3
 * Reference: task-1.4.16 Sprint 4 Phase 1
 */
import type { Meta, StoryObj } from '@storybook/react';
import { AvatarSingle, Avatar, AvatarFallback } from './ui/avatar';

const meta: Meta<typeof AvatarSingle> = {
  title: 'Components/Avatar',
  component: AvatarSingle,
  tags: ['autodocs'],
  argTypes: {
    size: {
      control: { type: 'select' },
      options: ['sm', 'md', 'lg', 'xl'],
    },
  },
};

export default meta;
type Story = StoryObj<typeof AvatarSingle>;

export const Default: Story = {
  args: { alt: 'Yassine Alami', fallback: 'YA', size: 'md' },
};

export const WithImage: Story = {
  args: {
    src: 'https://i.pravatar.cc/150?img=3',
    alt: 'Courtier Skalean',
    fallback: 'CS',
    size: 'md',
  },
};

export const Fallback: Story = {
  args: { alt: 'Rachid Bennani', fallback: 'RB', size: 'lg' },
};

export const Small: Story = {
  args: { fallback: 'AB', size: 'sm', alt: 'Ahmad B' },
};

export const Group: Story = {
  render: () => (
    <div className="flex -space-x-2">
      <AvatarSingle fallback="YA" alt="Yassine" size="md" />
      <AvatarSingle fallback="RB" alt="Rachid" size="md" />
      <AvatarSingle fallback="SM" alt="Sara" size="md" />
      <Avatar className="h-10 w-10 rounded-full border-2 border-background bg-muted flex items-center justify-center text-xs">
        <AvatarFallback>+4</AvatarFallback>
      </Avatar>
    </div>
  ),
};
