
        import { validateTask } from '../src/schema/validation';
        import { tasks } from '../src/system';
        
        const task = tasks['validate-todo'];
        
        describe('Validate Todo Test Suite', () => {
          
              it('should have a valid task schema', () => {
                const validationResult = validateTask(task);
                expect(validationResult.success).toBe(true);
              });
            
        });
      