import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Answer } from './Answer';
import { Citation } from '../types';

const citations: Citation[] = [
  {
    marker: '[1]',
    index: 1,
    name: 'Alpha',
    path: '/f',
    link: 'https://drive.google.com/file/d/a/view',
  },
  {
    marker: '[2:p3]',
    index: 2,
    page: 3,
    name: 'Beta',
    path: '/f',
    link: 'https://drive.google.com/file/d/b/view#page=3',
  },
];

describe('Answer', () => {
  it('renders citation markers as anchored links', () => {
    render(<Answer text="The value is 42 [1] and see [2:p3]." citations={citations} />);
    const alpha = screen.getByRole('link', { name: '[1]' });
    expect(alpha).toHaveAttribute('href', 'https://drive.google.com/file/d/a/view');
    const beta = screen.getByRole('link', { name: '[2:p3]' });
    expect(beta).toHaveAttribute('href', 'https://drive.google.com/file/d/b/view#page=3');
  });

  it('leaves unmatched markers as plain text', () => {
    const { container } = render(<Answer text="No source [9] here." citations={citations} />);
    expect(container.querySelectorAll('a')).toHaveLength(0);
    expect(container.textContent).toContain('[9]');
  });

  it('renders plain prose without links', () => {
    const { container } = render(<Answer text="Just prose." citations={[]} />);
    expect(container.querySelectorAll('a')).toHaveLength(0);
  });

  it('renders **bold** and *italic* as real elements, not raw asterisks', () => {
    const { container } = render(<Answer text="A **bold** and *soft* word." citations={[]} />);
    expect(container.querySelector('strong')?.textContent).toBe('bold');
    expect(container.querySelector('em')?.textContent).toBe('soft');
    expect(container.textContent).not.toContain('**');
  });

  it('renders markdown lists as list elements', () => {
    const { container } = render(<Answer text={'- one\n- two'} citations={[]} />);
    expect(container.querySelectorAll('ul li')).toHaveLength(2);
  });

  it('keeps citation links inside bold text', () => {
    const { container } = render(<Answer text="**Game Theory [1]**" citations={citations} />);
    expect(container.querySelector('strong a')).toHaveAttribute(
      'href',
      'https://drive.google.com/file/d/a/view',
    );
  });
});
