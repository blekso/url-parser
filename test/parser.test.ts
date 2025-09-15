/*
  Test style: AAA (Arrange–Act–Assert)
  - Separates setup, execution, and verification for clarity
  - Keeps tests readable and easy to maintain/refactor
*/
import { parseUrls } from "../src/parser";

describe("URL Parser", () => {
  it("ignores urls not in brackets", () => {
    // Arrange
    const input = "bla bla asdfasdf www.google.com";
    const expected: string[] = [];

    // Act
    const result = parseUrls(input);

    // Assert
    expect(result).toEqual(expected);
  });

  it("detects url in simple brackets", () => {
    // Arrange
    const input = "here, [ www.google.com ] fg";
    const expected = ["www.google.com"];

    // Act
    const result = parseUrls(input);

    // Assert
    expect(result).toEqual(expected);
  });

  it("detects last url if multiple inside", () => {
    // Arrange
    const input = "[bla www.first.com asdfasdf www.second.com truc]";
    const expected = ["www.second.com"];

    // Act
    const result = parseUrls(input);

    // Assert
    expect(result).toEqual(expected);
  });

  it("treats nested brackets as flat outermost", () => {
    // Arrange
    const input = "multiple levels[ [www.first.com] www.second.com]";
    const expected = ["www.second.com"];

    // Act
    const result = parseUrls(input);

    // Assert
    expect(result).toEqual(expected);
  });

  it("handles irregular brackets gracefully", () => {
    // Arrange
    const input = "unclosed [ www.google.com ";
    const expected: string[] = [];

    // Act
    const result = parseUrls(input);

    // Assert
    expect(result).toEqual(expected);
  });

  it("ignores escaped brackets", () => {
    // Arrange
    const input = "asdf \\[www.google.com]";
    const expected: string[] = [];

    // Act
    const result = parseUrls(input);

    // Assert
    expect(result).toEqual(expected);
  });
});
