import Image from "next/image";

type CompanyIdentityProps = {
  className: string;
};

export default function CompanyIdentity({ className }: CompanyIdentityProps) {
  return (
    <span className={`company-identity ${className}`}>
      <Image
        className="company-identity__logo"
        src="/company-logo.jpg"
        alt="Нишони Корхонаи воҳиди давлатии «Пажӯҳишгоҳи илмию тадқиқотии Сохтмон ва меъморӣ»"
        width={768}
        height={768}
        priority
      />
      <span className="company-identity__text">
        <strong className="company-identity__tajik" lang="tg">
          Корхонаи воҳиди давлатии «Пажӯҳишгоҳи илмию тадқиқотии «Сохтмон ва меъморӣ»»
        </strong>
        <span className="company-identity__russian" lang="ru">
          Государственное унитарное предприятие «Научно-исследовательский институт «Строительство и архитектура»»
        </span>
      </span>
    </span>
  );
}
