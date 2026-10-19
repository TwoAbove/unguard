interface Service {
  a(): Service;
  b(): Service;
  c(): Service;
  d(): Service;
  e(): string;
}
declare const alphaService: Service;

export const alpha = {
  load: (() => alphaService.a().b().c().d().e()),
};
