import { JSX, ReactNode } from "react";
import { useMediaQuery } from "usehooks-ts";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerGrabBar,
  DrawerHeader,
  DrawerTitle,
} from "~/components/ui/drawer";

type Props = {
  open: boolean;
  setOpen: (open: boolean) => void;
  title: string;
  children: ReactNode;
  icon?: JSX.Element;
  description?: string;
};

export function DrawerDialog(props: Props) {
  const isDesktop = useMediaQuery("(min-width: 768px)");

  if (isDesktop) {
    return (
      <Dialog open={props.open} onOpenChange={props.setOpen}>
        <DialogContent>
          <DialogHeader>
            {props.icon ? <div className="mb-4 size-8 self-center">{props.icon}</div> : null}
            <DialogTitle>{props.title}</DialogTitle>
            <DialogDescription>{props.description}</DialogDescription>
          </DialogHeader>
          {props.children}
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Drawer open={props.open} onOpenChange={props.setOpen}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerGrabBar />
          {props.icon ? <div className="flex items-center justify-center">{props.icon}</div> : null}
          <DrawerTitle>{props.title}</DrawerTitle>
          <DrawerDescription>{props.description}</DrawerDescription>
        </DrawerHeader>
        <div className="flex flex-col gap-4 px-4 pb-4">{props.children}</div>
      </DrawerContent>
    </Drawer>
  );
}

export function DrawerDialogFooter(props: { children: ReactNode; className?: string }) {
  const isDesktop = useMediaQuery("(min-width: 768px)");

  if (isDesktop) {
    return <DialogFooter className={props.className}>{props.children}</DialogFooter>;
  }

  return <DrawerFooter className={props.className}>{props.children}</DrawerFooter>;
}
