import React from 'react';

interface DzMahallLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showText?: boolean;
  showSubtitle?: boolean;
  className?: string;
  theme?: 'light' | 'dark';
}

export const DzMahallLogo: React.FC<DzMahallLogoProps> = ({
  size = 'md',
  showText = true,
  showSubtitle = false,
  className = '',
  theme = 'light',
}) => {
  const sizeMap = {
    sm: { icon: 32, font: 'text-base', sub: 'text-[9px]' },
    md: { icon: 42, font: 'text-xl', sub: 'text-[10px]' },
    lg: { icon: 56, font: 'text-2xl', sub: 'text-xs' },
    xl: { icon: 84, font: 'text-3xl', sub: 'text-sm' },
  };

  const { icon, font, sub } = sizeMap[size];

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {/* Official circular DM emblem from uploaded DzMahall logo */}
      <div
        className="relative shrink-0 rounded-full flex items-center justify-center shadow-md transition-transform hover:scale-105 overflow-hidden"
        style={{
          width: icon,
          height: icon,
          boxShadow: '0 0 0 2px #DFE3E8, 0 0 0 3.5px #FF6500, 0 4px 12px -2px rgba(255, 101, 0, 0.35)',
        }}
        title="DzMahall - Boutique en Ligne « Le bon choix. Livré chez vous, vérifié par vous. »"
      >
        <img
          src="/assets/aistudio/logo_e0e2fa2a.jpg"
          alt="Logo DzMahall"
          className="w-full h-full object-cover scale-[1.22] rounded-full select-none"
        />
      </div>

      {/* Brand Text */}
      {showText && (
        <div className="flex flex-col min-w-0">
          <div className="flex items-center gap-1.5">
            <span className={`${font} font-extrabold tracking-tight font-['Plus_Jakarta_Sans'] ${theme === 'dark' ? 'text-white' : 'text-[#212B36]'}`}>
              Dz<span className="text-[#FF6500]">Mahall</span>
            </span>
          </div>
          {showSubtitle && (
            <span className={`${sub} tracking-wide font-semibold ${theme === 'dark' ? 'text-slate-400' : 'text-[#637381]'} -mt-0.5 leading-tight max-w-[190px] sm:max-w-none`}>
              Boutique en Ligne « Le bon choix. Livré chez vous, vérifié par vous. »
            </span>
          )}
        </div>
      )}
    </div>
  );
};
