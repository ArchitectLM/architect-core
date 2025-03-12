
      import { validateSystem } from '../src/schema/validation';
      import system from '../src/system';
      
      describe('Todo System Test Suite', () => {
        
            it('should have a valid system schema', () => {
              const validationResult = validateSystem(system);
              expect(validationResult.success).toBe(true);
            });
          
      });
    