
        import { validateProcess } from '../src/schema/validation';
        import { processes } from '../src/system';
        
        const process = processes['manage-lists'];
        
        describe('Manage Todo Lists Test Suite', () => {
          
              it('should have a valid process schema', () => {
                const validationResult = validateProcess(process);
                expect(validationResult.success).toBe(true);
              });
            
        });
      