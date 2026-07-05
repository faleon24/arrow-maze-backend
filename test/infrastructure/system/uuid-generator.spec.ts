import { UuidGenerator } from '../../../src/infrastructure/system/uuid-generator';

describe('UuidGenerator', () => {
  describe('generate', () => {
    it('should_return_a_string', () => {
      // Arrange
      const generator = new UuidGenerator();

      // Act
      const id = generator.generate();

      // Assert
      expect(typeof id).toBe('string');
    });

    it('should_return_a_string_matching_uuid_v4_shape', () => {
      // Arrange
      const generator = new UuidGenerator();
      // RFC 4122 v4: 8-4-4-4-12 hex, with the third block starting with '4'
      // and the fourth block starting with 8, 9, a, or b.
      const uuidRegex =
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

      // Act
      const id = generator.generate();

      // Assert
      expect(id).toMatch(uuidRegex);
    });

    it('should_produce_a_different_value_on_each_call', () => {
      // Arrange
      const generator = new UuidGenerator();

      // Act
      const a = generator.generate();
      const b = generator.generate();

      // Assert
      expect(a).not.toBe(b);
    });
  });
});