import { renderHook, act } from '@testing-library/react';
import { useLocalStorage } from '../hooks/useLocalStorage';

beforeEach(() => localStorage.clear());

describe('useLocalStorage', () => {
  it('returns the initial value when nothing is stored', () => {
    const { result } = renderHook(() => useLocalStorage('test_key', 42));
    expect(result.current[0]).toBe(42);
  });

  it('persists a new value to localStorage', () => {
    const { result } = renderHook(() => useLocalStorage('test_key', 0));
    act(() => result.current[1](99));
    expect(result.current[0]).toBe(99);
    expect(JSON.parse(localStorage.getItem('test_key'))).toBe(99);
  });

  it('supports functional updates', () => {
    const { result } = renderHook(() => useLocalStorage('test_key', 10));
    act(() => result.current[1](prev => prev + 5));
    expect(result.current[0]).toBe(15);
  });

  it('reads an existing value from localStorage on mount', () => {
    localStorage.setItem('test_key', JSON.stringify('hello'));
    const { result } = renderHook(() => useLocalStorage('test_key', 'default'));
    expect(result.current[0]).toBe('hello');
  });

  it('falls back to initial value when localStorage contains invalid JSON', () => {
    localStorage.setItem('test_key', 'not-json{{{');
    const { result } = renderHook(() => useLocalStorage('test_key', 'fallback'));
    expect(result.current[0]).toBe('fallback');
  });
});
