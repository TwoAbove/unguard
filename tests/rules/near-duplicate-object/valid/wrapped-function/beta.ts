interface Service {
  a(): Service;
  b(): Service;
  c(): Service;
  d(): Service;
  e(): string;
}
declare const betaService: Service;

export const beta = {
  load: (() => betaService.a().b().c().d().e()),
};
