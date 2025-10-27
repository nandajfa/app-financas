import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

export interface TransactionFormValues {
  estabelecimento: string;
  valor: string;
  tipo: "receita" | "despesa";
  categoria: string;
  quando: string;
  detalhes: string;
}

interface TransactionFormProps {
  title?: string;
  submitLabel: string;
  initialValues?: Partial<TransactionFormValues>;
  onSubmit: (values: TransactionFormValues) => void;
  onCancel?: () => void;
  submitting?: boolean;
}

const todayISO = () => {
  const now = new Date();
  const month = `${now.getMonth() + 1}`.padStart(2, "0");
  const day = `${now.getDate()}`.padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
};

const normalizeDateValue = (value?: string) => {
  if (!value) return todayISO();
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  const month = `${parsed.getMonth() + 1}`.padStart(2, "0");
  const day = `${parsed.getDate()}`.padStart(2, "0");
  return `${parsed.getFullYear()}-${month}-${day}`;
};

const createDefaultValues = (): TransactionFormValues => ({
  estabelecimento: "",
  valor: "",
  tipo: "despesa",
  categoria: "",
  quando: todayISO(),
  detalhes: "",
});

const TransactionForm = ({
  title,
  submitLabel,
  initialValues,
  onSubmit,
  onCancel,
  submitting,
}: TransactionFormProps) => {
  const [values, setValues] = useState<TransactionFormValues>(createDefaultValues);
  const previousSubmitting = useRef<boolean>(Boolean(submitting));

  useEffect(() => {
    setValues((prev) => ({
      ...prev,
      estabelecimento: initialValues?.estabelecimento ?? "",
      valor: initialValues?.valor ?? "",
      tipo: (initialValues?.tipo as "receita" | "despesa") ?? "despesa",
      categoria: initialValues?.categoria ?? "",
      quando: normalizeDateValue(initialValues?.quando),
      detalhes: initialValues?.detalhes ?? "",
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialValues?.estabelecimento, initialValues?.valor, initialValues?.tipo, initialValues?.categoria, initialValues?.quando, initialValues?.detalhes]);

  useEffect(() => {
    if (!initialValues && previousSubmitting.current && submitting === false) {
      setValues(createDefaultValues());
    }
    previousSubmitting.current = Boolean(submitting);
  }, [initialValues, submitting]);

  const isSubmitDisabled = useMemo(() => {
    return (
      !values.estabelecimento.trim() ||
      !values.valor.trim() ||
      Number.isNaN(Number(values.valor)) ||
      !values.quando
    );
  }, [values.estabelecimento, values.valor, values.quando]);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSubmitDisabled) return;
    onSubmit(values);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {title && (
        <div>
          <h3 className="text-lg font-semibold mb-2">{title}</h3>
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="estabelecimento">Estabelecimento</Label>
          <Input
            id="estabelecimento"
            value={values.estabelecimento}
            onChange={(event) =>
              setValues((prev) => ({ ...prev, estabelecimento: event.target.value }))
            }
            placeholder="Ex.: Supermercado"
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="valor">Valor</Label>
          <Input
            id="valor"
            type="number"
            min="0"
            step="0.01"
            value={values.valor}
            onChange={(event) =>
              setValues((prev) => ({ ...prev, valor: event.target.value }))
            }
            placeholder="0,00"
            required
          />
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="tipo">Tipo</Label>
          <Select
            value={values.tipo}
            onValueChange={(value) =>
              setValues((prev) => ({ ...prev, tipo: value as "receita" | "despesa" }))
            }
          >
            <SelectTrigger id="tipo">
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="receita">Receita</SelectItem>
              <SelectItem value="despesa">Despesa</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="categoria">Categoria</Label>
          <Input
            id="categoria"
            value={values.categoria}
            onChange={(event) =>
              setValues((prev) => ({ ...prev, categoria: event.target.value }))
            }
            placeholder="Ex.: Alimentação"
          />
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="quando">Data</Label>
          <Input
            id="quando"
            type="date"
            value={values.quando}
            onChange={(event) =>
              setValues((prev) => ({ ...prev, quando: event.target.value }))
            }
            required
          />
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="detalhes">Detalhes</Label>
          <Textarea
            id="detalhes"
            value={values.detalhes}
            onChange={(event) =>
              setValues((prev) => ({ ...prev, detalhes: event.target.value }))
            }
            placeholder="Informações adicionais"
            rows={3}
          />
        </div>
      </div>
      <div className="flex flex-col md:flex-row md:items-center md:justify-end gap-3">
        {onCancel && (
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={submitting}
          >
            Cancelar
          </Button>
        )}
        <Button
          type="submit"
          className="bg-gradient-primary hover:opacity-90 transition-opacity"
          disabled={submitting || isSubmitDisabled}
        >
          {submitting ? "Salvando..." : submitLabel}
        </Button>
      </div>
    </form>
  );
};

export default TransactionForm;
