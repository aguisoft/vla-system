import { Global, Module, OnModuleInit } from '@nestjs/common';
import { HookService } from './hook.service';
import { CORE_HOOKS } from './hook.constants';

@Global()
@Module({
  providers: [HookService],
  exports: [HookService],
})
export class HookModule implements OnModuleInit {
  constructor(private readonly hooks: HookService) {}

  onModuleInit() {
    // Declare all core hooks with documentation metadata
    this.hooks.declareHook(CORE_HOOKS.USER_CREATED, 'core', {
      description: 'Se dispara después de crear un nuevo usuario',
      payload: { user: '{ id, email, firstName, lastName, role }' },
    });
    this.hooks.declareHook(CORE_HOOKS.USER_UPDATED, 'core', {
      description: 'Se dispara después de actualizar un usuario',
      payload: { userId: 'string', changes: 'Partial<User>' },
    });
    this.hooks.declareHook(CORE_HOOKS.USER_SERIALIZE, 'core', {
      description: 'Filtro: transforma el usuario antes de devolverlo por API',
      payload: { user: 'User' },
    });
    this.hooks.declareHook(CORE_HOOKS.AUTH_LOGIN, 'core', {
      description: 'Se dispara después de un login exitoso',
      payload: { user: 'AuthUser', token: 'string' },
    });
    this.hooks.declareHook(CORE_HOOKS.AUTH_GOOGLE_LOGIN, 'core', {
      description: 'Se dispara después de login/registro con Google OAuth',
      payload: { user: 'User', isNew: 'boolean' },
    });
    this.hooks.declareHook(CORE_HOOKS.PLUGIN_ACTIVATED, 'core', {
      description: 'Se dispara cuando un plugin es activado',
      payload: { pluginName: 'string' },
    });
    this.hooks.declareHook(CORE_HOOKS.PLUGIN_DEACTIVATED, 'core', {
      description: 'Se dispara cuando un plugin es desactivado',
      payload: { pluginName: 'string' },
    });
    this.hooks.declareHook(CORE_HOOKS.PERMISSIONS_REGISTER, 'core', {
      description: 'Filtro: registrar permisos del plugin en el mapa global de capabilities',
      payload: { '[permKey]': '{ label: string, group: string, plugin?: string }' },
    });
    this.hooks.declareHook(CORE_HOOKS.PERMISSIONS_EXTEND, 'core', {
      description: 'Filtro: extender permisos resueltos de un usuario al login',
      payload: { permissions: 'string[]', userId: 'string', role: 'string' },
    });
    this.hooks.declareHook(CORE_HOOKS.ROLES_PRESET, 'core', {
      description: 'Filtro: registrar roles predefinidos sugeridos en el editor de roles',
      payload: { '[]': '{ name, description?, permissions[], color?, plugin }' },
    });
  }
}
