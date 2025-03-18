// @component type:function
// @component id:base-auth-001
// @component version:1.0.0
// @component author:system
// @component tags:auth,security,base
// @component dependencies:["jsonwebtoken", "bcrypt", "rate-limiter-flexible", "winston"]

// @interface BaseAuthConfig
interface BaseAuthConfig {
  // @property secretKey:string
  secretKey: string;
  
  // @property tokenExpiration:number
  tokenExpiration: number;
  
  // @property refreshTokenExpiration:number
  refreshTokenExpiration: number;
  
  // @property rateLimit:number
  rateLimit: number;
}

// @class BaseAuthenticator
class BaseAuthenticator {
  // @property config:BaseAuthConfig
  protected config: BaseAuthConfig;
  
  // @constructor
  constructor(config: BaseAuthConfig) {
    this.config = config;
  }
  
  // @method generateToken
  // @param user:any
  // @returns string
  protected generateToken(user: any): string {
    const token = require('jsonwebtoken').sign(user, this.config.secretKey, { expiresIn: this.config.tokenExpiration });
    return token;
  }
  
  // @method validateToken
  // @param token:string
  // @returns any
  protected validateToken(token: string): any {
    try {
      const decoded = require('jsonwebtoken').verify(token, this.config.secretKey);
      return decoded;
    } catch (error) {
      return null;
    }
  }
  
  // @method hashPassword
  // @param password:string
  // @returns string
  protected hashPassword(password: string): string {
    const hashedPassword = require('bcrypt').hashSync(password, 10);
    return hashedPassword;
  }
  
  // @method comparePassword
  // @param password:string
  // @param hashedPassword:string
  // @returns boolean
  protected comparePassword(password: string, hashedPassword: string): boolean {
    const isValid = require('bcrypt').compareSync(password, hashedPassword);
    return isValid;
  }
}

// @relationships
// @dependsOn:["UserService"]
// @usedBy:["AuthMiddleware"]
// @extends:["IAuthenticator"]
// @implements:["IAuthenticator"] 