
        import { validateTask } from '../src/schema/validation';
        import { tasks } from '../src/system';
        
        const task = tasks['save-todo'];
        
        describe('Save Todo Test Suite', () => {
          
              it('should have a valid task schema', () => {
                const validationResult = validateTask(task);
                expect(validationResult.success).toBe(true);
              });
            
        });
      