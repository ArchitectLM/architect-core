
        import { validateTask } from '../src/schema/validation';
        import { tasks } from '../src/system';
        
        const task = tasks['save-list'];
        
        describe('Save List Test Suite', () => {
          
              it('should have a valid task schema', () => {
                const validationResult = validateTask(task);
                expect(validationResult.success).toBe(true);
              });
            
        });
      